package users

import (
	"context"
	"fmt"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/db"
	"roomdate-backend/internal/validate"
)

// Chiave di recupero (modulo M3.4, decisione D3).
//
// Il browser genera un codice casuale da 120 bit e ne ricava due chiavi: la chiave di verifica,
// inviata al server, che ne salva solo l'hash Argon2id; e la chiave che cifra una copia della chiave
// privata delle chat. Chi dimentica la password dimostra di avere il codice e imposta una password
// nuova, senza perdere i messaggi. Il server non riceve mai il codice e non può aprire la copia.

var errInvalidRecovery = apperr.Unauthorized("invalid_recovery", "Email o chiave di recupero non valide")

// RecoveryInput è una chiave di recupero come la prepara il browser. EncryptedPrivateKey e IV
// sono vuoti per gli account senza chiavi di cifratura.
type RecoveryInput struct {
	Salt                string `json:"salt"`
	AuthKey             string `json:"authKey"`
	EncryptedPrivateKey string `json:"encryptedPrivateKey"`
	IV                  string `json:"iv"`
}

func checkRecovery(v *validate.Validator, r RecoveryInput, hasVault bool) {
	v.Check(validate.Base64(r.Salt, 128) && len(r.Salt) >= 16, "recovery", "Chiave di recupero non valida")
	v.Check(validate.Base64(r.AuthKey, 128) && r.AuthKey != "", "recovery", "Chiave di recupero non valida")
	if hasVault {
		// Senza la copia della chiave privata il recupero farebbe perdere tutte le chat
		v.Check(r.EncryptedPrivateKey != "" && validate.Base64(r.EncryptedPrivateKey, 4096) &&
			validate.Base64(r.IV, 64) && r.IV != "", "recovery", "Chiave di recupero non valida")
	}
}

// hashRecovery prepara la chiave di recupero da salvare: della chiave di verifica resta solo l'hash.
func hashRecovery(r RecoveryInput) (Recovery, error) {
	hash, err := auth.HashPassword(r.AuthKey)
	if err != nil {
		return Recovery{}, fmt.Errorf("hash della chiave di recupero: %w", err)
	}
	return Recovery{Salt: r.Salt, Hash: hash, EncryptedPrivateKey: r.EncryptedPrivateKey, IV: r.IV}, nil
}

// SetRecoveryInput crea o sostituisce la chiave di recupero; serve la password attuale.
type SetRecoveryInput struct {
	CurrentPassword string        `json:"currentPassword"`
	Recovery        RecoveryInput `json:"recovery"`
}

// SetRecoveryKey crea o sostituisce la chiave di recupero: quella precedente smette di valere.
func (s *Service) SetRecoveryKey(ctx context.Context, userID string, in SetRecoveryInput) error {
	account, err := s.store.AccountByID(ctx, userID)
	if db.IsNoRows(err) || db.IsInvalidInput(err) {
		return errSessionInvalid
	}
	if err != nil {
		return fmt.Errorf("lettura account: %w", err)
	}

	var v validate.Validator
	checkRecovery(&v, in.Recovery, account.Vault.EncryptedPrivateKey != "")
	if err := v.Err(); err != nil {
		return err
	}
	if ok, _ := auth.CheckPassword(account.PasswordHash, in.CurrentPassword); !ok {
		return apperr.Unauthorized("invalid_credentials", "La password non è corretta")
	}

	recovery, err := hashRecovery(in.Recovery)
	if err != nil {
		return err
	}
	if err := s.store.SetRecovery(ctx, userID, recovery); err != nil {
		return fmt.Errorf("salvataggio della chiave di recupero: %w", err)
	}
	s.record(ctx, auth.Event{Kind: auth.EventRecoveryKeySet, UserID: userID})
	return nil
}

// RecoveryStart restituisce il sale con cui il browser ricava le chiavi dal codice di recupero.
// Per un indirizzo inesistente, o senza chiave di recupero, il sale è finto ma sempre uguale:
// la risposta non dice chi è registrato né chi ha una chiave.
func (s *Service) RecoveryStart(ctx context.Context, email string) (string, error) {
	account, err := s.store.RecoveryByEmail(ctx, normalizeEmail(email))
	if err != nil && !db.IsNoRows(err) {
		return "", fmt.Errorf("lettura account: %w", err)
	}
	if err != nil || account.Recovery.Hash == "" {
		return s.fakeSaltFor("recovery", email), nil
	}
	return account.Recovery.Salt, nil
}

// RecoveryProof è la prova di possedere il codice di recupero, con la provenienza della richiesta.
type RecoveryProof struct {
	Email       string `json:"email"`
	RecoveryKey string `json:"recoveryKey"`
	IPHash      string `json:"-"`
}

// RecoveredKeys è la copia della chiave privata cifrata con il codice di recupero.
// È null per gli account senza chiavi di cifratura.
type RecoveredKeys struct {
	PublicKey           string `json:"publicKey"`
	EncryptedPrivateKey string `json:"encryptedPrivateKey"`
	IV                  string `json:"iv"`
}

// verifyRecovery controlla la prova, con le stesse attese crescenti dell'accesso.
func (s *Service) verifyRecovery(ctx context.Context, p RecoveryProof) (RecoveryAccount, error) {
	emailHash := s.hash(normalizeEmail(p.Email))
	failures, err := s.security.RecentFailures(ctx, auth.EventRecoveryFailed, emailHash, p.IPHash, auth.ThrottleWindow)
	if err != nil {
		return RecoveryAccount{}, fmt.Errorf("lettura tentativi recenti: %w", err)
	}
	if wait := auth.RetryAfter(failures, s.now()); wait > 0 {
		return RecoveryAccount{}, apperr.TooManyRequests("too_many_attempts",
			fmt.Sprintf("Troppi tentativi: riprova tra %d minuti", int(wait.Minutes())+1))
	}

	account, err := s.store.RecoveryByEmail(ctx, normalizeEmail(p.Email))
	if err != nil && !db.IsNoRows(err) {
		return RecoveryAccount{}, fmt.Errorf("lettura account: %w", err)
	}
	valid := err == nil && account.Recovery.Hash != ""
	if valid {
		valid, _ = auth.CheckPassword(account.Recovery.Hash, p.RecoveryKey)
	}
	if !valid {
		s.record(ctx, auth.Event{Kind: auth.EventRecoveryFailed, UserID: account.UserID, EmailHash: emailHash, IPHash: p.IPHash})
		return RecoveryAccount{}, errInvalidRecovery
	}
	// Come per l'accesso, la sospensione si rivela solo a chi ha dimostrato di possedere l'account
	if account.Suspended {
		return RecoveryAccount{}, errAccountSuspended
	}
	return account, nil
}

// RecoveryVerify controlla il codice e restituisce la copia della chiave privata, che il browser
// apre con il codice per cifrarla di nuovo con la password nuova.
func (s *Service) RecoveryVerify(ctx context.Context, p RecoveryProof) (*RecoveredKeys, error) {
	account, err := s.verifyRecovery(ctx, p)
	if err != nil {
		return nil, err
	}
	if account.Recovery.EncryptedPrivateKey == "" {
		return nil, nil
	}
	return &RecoveredKeys{PublicKey: account.PublicKey, EncryptedPrivateKey: account.Recovery.EncryptedPrivateKey, IV: account.Recovery.IV}, nil
}

// RecoveryCompleteInput imposta la password nuova: chiave d'accesso, parametri e chiave privata
// cifrata con la chiave ricavata dalla nuova password.
type RecoveryCompleteInput struct {
	RecoveryProof
	NewPassword string          `json:"newPassword"`
	KDF         *auth.KDFParams `json:"kdf"`
	Keys        *Vault          `json:"keys"`
}

// RecoveryComplete imposta la nuova password e chiude tutte le sessioni aperte: chi le aveva
// (magari proprio chi ha fatto dimenticare la password) deve rifare l'accesso.
func (s *Service) RecoveryComplete(ctx context.Context, in RecoveryCompleteInput, revokeSessions func(ctx context.Context, userID string) error) error {
	var kdf auth.KDFParams
	if in.KDF != nil {
		kdf = *in.KDF
	}
	var v validate.Validator
	checkSecret(&v, "newPassword", in.NewPassword, kdf, "", "")
	checkKDF(&v, kdf)
	if err := v.Err(); err != nil {
		return err
	}

	recovered, err := s.verifyRecovery(ctx, in.RecoveryProof)
	if err != nil {
		return err
	}
	account, err := s.store.AccountByID(ctx, recovered.UserID)
	if err != nil {
		return fmt.Errorf("lettura account: %w", err)
	}

	var newVault Vault
	if in.Keys != nil {
		newVault = *in.Keys
	}
	if account.Vault.EncryptedPrivateKey != "" {
		v.Check(newVault.EncryptedPrivateKey != "" && validate.Base64(newVault.EncryptedPrivateKey, 4096) &&
			validate.Base64(newVault.CryptoIV, 64) && newVault.CryptoIV != "", "keys", "Chiavi di cifratura mancanti")
		if err := v.Err(); err != nil {
			return err
		}
	}

	hash, err := auth.HashPassword(in.NewPassword)
	if err != nil {
		return fmt.Errorf("hash della chiave di accesso: %w", err)
	}
	if err := s.store.UpdatePassword(ctx, account.ID, hash, kdf, newVault); err != nil {
		return fmt.Errorf("aggiornamento password: %w", err)
	}
	if err := revokeSessions(ctx, account.ID); err != nil {
		return fmt.Errorf("chiusura delle sessioni: %w", err)
	}
	s.record(ctx, auth.Event{Kind: auth.EventPasswordRecovered, UserID: account.ID, IPHash: in.IPHash})
	return nil
}
