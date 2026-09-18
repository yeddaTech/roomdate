package users

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/db"
	"roomdate-backend/internal/logx"
	"roomdate-backend/internal/page"
	"roomdate-backend/internal/validate"
	"roomdate-backend/shared"
)

// Tipi di utente ammessi.
const (
	UserTypeSeeker   = "cerca"
	UserTypeLandlord = "affitta"
)

// Dimensioni delle pagine dell'elenco dei coinquilini.
const (
	roommatesDefaultLimit = 24
	roommatesMaxLimit     = 50
)

var (
	errSessionInvalid = apperr.Unauthorized("session_invalid", "Sessione scaduta: accedi di nuovo")
	// Messaggio unico per email inesistente e password errata: distinguerli direbbe a chiunque
	// quali indirizzi sono registrati.
	errInvalidCredentials = apperr.Unauthorized("invalid_credentials", "Credenziali non valide")
	errUserNotFound       = apperr.NotFound("user_not_found", "Utente non trovato")
)

type Service struct {
	store *Store
	// security registra accessi e operazioni delicate, e conta i tentativi falliti recenti
	security *auth.Store
	// hash calcola l'impronta di email e indirizzi IP, che nel registro sostituiscono i valori veri
	hash func(string) string
	// images cancella dallo storage le foto degli annunci di un account eliminato
	images func(ctx context.Context, keys []string)
	now    func() time.Time
}

func NewService(store *Store, security *auth.Store, hash func(string) string, deleteImages func(ctx context.Context, keys []string)) *Service {
	return &Service{store: store, security: security, hash: hash, images: deleteImages, now: time.Now}
}

// RegisterInput sono i dati del modulo di registrazione.
type RegisterInput struct {
	FirstName  string `json:"firstName"`
	LastName   string `json:"lastName"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	City       string `json:"city"`
	UserType   string `json:"userType"`
	Birthdate  string `json:"birthdate"`
	BudgetMax  int    `json:"budgetMax"`
	Occupation string `json:"occupation"`
	Bio        string `json:"bio"`
	// LifestyleTags sono chiavi di shared.LifestyleTags.
	LifestyleTags []string `json:"lifestyleTags"`
	Keys          *Vault   `json:"keys"`
	// KDF descrive come il browser ha ricavato Password dalla password scritta dall'utente.
	KDF *auth.KDFParams `json:"kdf"`
}

// normalizeEmail rende uguali gli indirizzi che differiscono solo per maiuscole o spazi (anomalia F2).
func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// Register crea l'account e restituisce l'ID del nuovo utente.
func (s *Service) Register(ctx context.Context, in RegisterInput) (string, error) {
	u := NewUser{
		FirstName:  validate.Text(in.FirstName),
		LastName:   validate.Text(in.LastName),
		Email:      normalizeEmail(in.Email),
		City:       validate.Text(in.City),
		UserType:   in.UserType,
		Birthdate:  in.Birthdate,
		BudgetMax:  in.BudgetMax,
		Occupation: in.Occupation,
		Bio:        validate.Text(in.Bio),
	}
	if in.Keys != nil {
		u.Vault = *in.Keys
	}

	if in.KDF != nil {
		u.KDF = *in.KDF
	}

	var v validate.Validator
	v.Check(validate.NotBlank(u.FirstName) && validate.MaxLen(u.FirstName, 50), "firstName", "Il nome è obbligatorio (massimo 50 caratteri)")
	v.Check(validate.NotBlank(u.LastName) && validate.MaxLen(u.LastName, 50), "lastName", "Il cognome è obbligatorio (massimo 50 caratteri)")
	v.Check(validate.Email(u.Email), "email", "Inserisci un indirizzo email valido")
	checkSecret(&v, "password", in.Password, u.KDF, u.Email, u.FirstName)
	checkKDF(&v, u.KDF)
	u.LifestyleTags = checkPersonalDetails(&v, s.now(), personalDetails{
		UserType: u.UserType, City: u.City, Birthdate: u.Birthdate, BudgetMax: u.BudgetMax,
		Occupation: u.Occupation, Bio: u.Bio, LifestyleTags: in.LifestyleTags,
	})
	checkVault(&v, u.Vault)
	if err := v.Err(); err != nil {
		return "", err
	}

	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		return "", fmt.Errorf("hash della password: %w", err)
	}
	u.PasswordHash = hash

	id, err := s.store.Create(ctx, u)
	if db.IsUniqueViolation(err) {
		return "", apperr.Conflict("registration_failed",
			"Impossibile completare la registrazione. Verifica i dati inseriti o accedi se hai già un account.")
	}
	if err != nil {
		return "", fmt.Errorf("creazione utente: %w", err)
	}
	return id, nil
}

// Prelogin restituisce i parametri con cui il browser deve ricavare le chiavi dalla password.
//
// Per un indirizzo non registrato risponde con un sale finto ma sempre uguale, ricavato
// dall'indirizzo stesso: dalla risposta non si capisce quali email esistono.
func (s *Service) Prelogin(ctx context.Context, email string) (auth.KDFParams, error) {
	account, err := s.store.AccountByEmail(ctx, normalizeEmail(email))
	if db.IsNoRows(err) {
		return auth.KDFParams{Version: auth.KDFDerived, Salt: s.fakeSalt(email), Iterations: auth.MinKDFIterations}, nil
	}
	if err != nil {
		return auth.KDFParams{}, fmt.Errorf("lettura account: %w", err)
	}
	if account.KDF.Version != auth.KDFDerived || account.KDF.Salt == "" {
		// Account non ancora aggiornato: il browser invia la password come prima e poi passa
		// al metodo nuovo, subito dopo l'accesso.
		return auth.KDFParams{Version: auth.KDFLegacy}, nil
	}
	return account.KDF, nil
}

// fakeSalt costruisce un sale credibile per un indirizzo inesistente: sempre lo stesso per lo
// stesso indirizzo, diverso da quello di chiunque altro, e non ricavabile senza il segreto del server.
func (s *Service) fakeSalt(email string) string {
	hash := s.hash("prelogin:" + normalizeEmail(email))
	raw, err := hex.DecodeString(hash)
	if err != nil || len(raw) < 16 {
		return base64.StdEncoding.EncodeToString([]byte(hash))[:24]
	}
	return base64.StdEncoding.EncodeToString(raw[:16])
}

// LoginInput sono i dati di un tentativo di accesso; IPHash identifica la provenienza
// senza salvare l'indirizzo.
type LoginInput struct {
	Email, Password, IPHash string
}

// Login verifica le credenziali. Dopo qualche tentativo fallito chiede di aspettare, con attese
// crescenti per indirizzo email e per provenienza: non blocca mai del tutto un account, perché
// basterebbe conoscere l'email di qualcuno per chiuderlo fuori.
func (s *Service) Login(ctx context.Context, in LoginInput) (Account, error) {
	emailHash := s.hash(normalizeEmail(in.Email))
	if err := s.checkLoginThrottle(ctx, emailHash, in.IPHash); err != nil {
		return Account{}, err
	}

	account, err := s.store.AccountByEmail(ctx, normalizeEmail(in.Email))
	if db.IsNoRows(err) {
		s.recordFailedLogin(ctx, "", emailHash, in.IPHash)
		return Account{}, errInvalidCredentials
	}
	if err != nil {
		return Account{}, fmt.Errorf("lettura account: %w", err)
	}

	ok, legacyHash := auth.CheckPassword(account.PasswordHash, in.Password)
	if !ok {
		s.recordFailedLogin(ctx, account.ID, emailHash, in.IPHash)
		return Account{}, errInvalidCredentials
	}

	// Gli account registrati con bcrypt passano ad Argon2id al primo accesso riuscito
	if legacyHash {
		if hash, err := auth.HashPassword(in.Password); err == nil {
			if err := s.store.UpdatePasswordHash(ctx, account.ID, hash); err != nil {
				logx.From(ctx).Warn("aggiornamento dell'hash della password non riuscito", "err", err)
			}
		}
	}
	s.record(ctx, auth.Event{Kind: auth.EventLoginOK, UserID: account.ID, EmailHash: emailHash, IPHash: in.IPHash})
	// Il registro si ripulisce a ogni accesso riuscito: l'indice sulla data rende la cancellazione
	// immediata quando non c'è nulla da togliere
	if err := s.security.DeleteOldEvents(ctx, auth.EventRetention); err != nil {
		logx.From(ctx).Warn("pulizia del registro di sicurezza non riuscita", "err", err)
	}
	return account, nil
}

// checkLoginThrottle rifiuta il tentativo se bisogna ancora aspettare.
func (s *Service) checkLoginThrottle(ctx context.Context, emailHash, ipHash string) error {
	failures, err := s.security.RecentFailedLogins(ctx, emailHash, ipHash, auth.ThrottleWindow)
	if err != nil {
		return fmt.Errorf("lettura tentativi recenti: %w", err)
	}
	wait := auth.RetryAfter(failures, s.now())
	if wait <= 0 {
		return nil
	}
	minutes := int(wait.Minutes()) + 1
	return apperr.TooManyRequests("too_many_attempts",
		fmt.Sprintf("Troppi tentativi di accesso: riprova tra %d minuti", minutes))
}

func (s *Service) recordFailedLogin(ctx context.Context, userID, emailHash, ipHash string) {
	s.record(ctx, auth.Event{Kind: auth.EventLoginFailed, UserID: userID, EmailHash: emailHash, IPHash: ipHash})
}

// record salva un evento di sicurezza: se non riesce, l'operazione dell'utente prosegue comunque.
func (s *Service) record(ctx context.Context, event auth.Event) {
	if err := s.security.RecordEvent(ctx, event); err != nil {
		logx.From(ctx).Warn("evento di sicurezza non registrato", "kind", event.Kind, "err", err)
	}
}

// SessionAccount restituisce l'account dell'utente in sessione.
// ok è false se l'utente non esiste più (ad esempio dopo l'eliminazione dell'account).
func (s *Service) SessionAccount(ctx context.Context, userID string) (account Account, ok bool, err error) {
	account, err = s.store.AccountByID(ctx, userID)
	if db.IsNoRows(err) || db.IsInvalidInput(err) {
		return Account{}, false, nil
	}
	if err != nil {
		return Account{}, false, fmt.Errorf("lettura account: %w", err)
	}
	return account, true, nil
}

// ChangePasswordInput sono i dati per il cambio password. Keys è la chiave privata E2EE
// cifrata di nuovo con la nuova password (senza chiave pubblica).
type ChangePasswordInput struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
	Keys            *Vault `json:"keys"`
	// KDF sono i nuovi parametri di derivazione: cambiando password cambia anche il sale.
	KDF *auth.KDFParams `json:"kdf"`
}

// ChangePassword richiede la password attuale e, se l'utente ha chiavi E2EE, la chiave privata
// cifrata di nuovo con la nuova password: senza, i messaggi diventerebbero illeggibili.
func (s *Service) ChangePassword(ctx context.Context, userID string, in ChangePasswordInput) error {
	account, err := s.store.AccountByID(ctx, userID)
	if db.IsNoRows(err) || db.IsInvalidInput(err) {
		return errSessionInvalid
	}
	if err != nil {
		return fmt.Errorf("lettura account: %w", err)
	}

	var kdf auth.KDFParams
	if in.KDF != nil {
		kdf = *in.KDF
	}

	var v validate.Validator
	checkSecret(&v, "newPassword", in.NewPassword, kdf, account.Email, account.FirstName)
	checkKDF(&v, kdf)
	if err := v.Err(); err != nil {
		return err
	}

	var newVault Vault
	if in.Keys != nil {
		newVault = *in.Keys
	}
	if account.Vault.EncryptedPrivateKey != "" {
		if newVault.EncryptedPrivateKey == "" || newVault.CryptoSalt == "" || newVault.CryptoIV == "" {
			return apperr.BadRequest("vault_required", "Chiavi di cifratura mancanti: esci, accedi di nuovo e riprova")
		}
		v.Check(validate.Base64(newVault.EncryptedPrivateKey, 4096) && validate.Base64(newVault.CryptoSalt, 64) &&
			validate.Base64(newVault.CryptoIV, 64), "keys", "Chiavi di cifratura non valide")
		if err := v.Err(); err != nil {
			return err
		}
	}

	// La password attuale va richiesta di nuovo: un computer lasciato aperto non deve bastare
	if ok, _ := auth.CheckPassword(account.PasswordHash, in.CurrentPassword); !ok {
		s.record(ctx, auth.Event{Kind: auth.EventLoginFailed, UserID: account.ID})
		return apperr.Unauthorized("invalid_credentials", "La password attuale non è corretta")
	}

	hash, err := auth.HashPassword(in.NewPassword)
	if err != nil {
		return fmt.Errorf("hash della password: %w", err)
	}
	if err := s.store.UpdatePassword(ctx, userID, hash, kdf, newVault); err != nil {
		return fmt.Errorf("aggiornamento password: %w", err)
	}
	s.record(ctx, auth.Event{Kind: auth.EventPasswordChanged, UserID: account.ID})
	return nil
}

// DeleteAccount elimina l'utente, i suoi annunci e le loro foto. La password va inserita di nuovo:
// è un'operazione irreversibile e non deve bastare una sessione lasciata aperta.
func (s *Service) DeleteAccount(ctx context.Context, userID, password string) error {
	account, err := s.store.AccountByID(ctx, userID)
	if db.IsNoRows(err) || db.IsInvalidInput(err) {
		return errSessionInvalid
	}
	if err != nil {
		return fmt.Errorf("lettura account: %w", err)
	}
	if ok, _ := auth.CheckPassword(account.PasswordHash, password); !ok {
		return apperr.Unauthorized("invalid_credentials", "La password non è corretta")
	}

	keys, err := s.store.Delete(ctx, userID)
	if err != nil {
		return apperr.Wrap(err, "delete_failed", "Impossibile eliminare l'account in questo momento")
	}
	s.images(ctx, keys)
	// L'evento resta senza utente: la riga dell'account non esiste più
	s.record(ctx, auth.Event{Kind: auth.EventAccountDeleted})
	return nil
}

// UpgradeKDFInput porta l'account al metodo nuovo: la chiave d'accesso ricavata dal browser,
// i suoi parametri e la chiave privata cifrata di nuovo con la chiave che resta nel browser.
type UpgradeKDFInput struct {
	CurrentPassword string          `json:"currentPassword"`
	AuthKey         string          `json:"authKey"`
	KDF             *auth.KDFParams `json:"kdf"`
	Keys            *Vault          `json:"keys"`
}

// UpgradeKDF aggiorna un account dal vecchio metodo (password al server) a quello nuovo.
// Avviene subito dopo un accesso riuscito, senza che l'utente debba fare nulla.
func (s *Service) UpgradeKDF(ctx context.Context, userID string, in UpgradeKDFInput) error {
	account, err := s.store.AccountByID(ctx, userID)
	if db.IsNoRows(err) || db.IsInvalidInput(err) {
		return errSessionInvalid
	}
	if err != nil {
		return fmt.Errorf("lettura account: %w", err)
	}
	if account.KDF.Version == auth.KDFDerived {
		return apperr.Conflict("kdf_already_upgraded", "Account già aggiornato")
	}

	var kdf auth.KDFParams
	if in.KDF != nil {
		kdf = *in.KDF
	}
	var v validate.Validator
	v.Check(validate.Base64(in.AuthKey, 128) && in.AuthKey != "", "authKey", "Chiave di accesso non valida")
	checkKDF(&v, kdf)
	if err := v.Err(); err != nil {
		return err
	}

	// Serve la password attuale: senza, una sessione rubata potrebbe cambiare le chiavi
	if ok, _ := auth.CheckPassword(account.PasswordHash, in.CurrentPassword); !ok {
		return apperr.Unauthorized("invalid_credentials", "La password non è corretta")
	}

	var newVault Vault
	if in.Keys != nil {
		newVault = *in.Keys
	}
	if account.Vault.EncryptedPrivateKey != "" && newVault.EncryptedPrivateKey == "" {
		return apperr.BadRequest("vault_required", "Chiavi di cifratura mancanti: esci, accedi di nuovo e riprova")
	}

	hash, err := auth.HashPassword(in.AuthKey)
	if err != nil {
		return fmt.Errorf("hash della chiave di accesso: %w", err)
	}
	if err := s.store.UpdatePassword(ctx, userID, hash, kdf, newVault); err != nil {
		return fmt.Errorf("aggiornamento chiavi: %w", err)
	}
	return nil
}

// RecordSessionsRevoked registra nel registro di sicurezza la chiusura degli altri accessi.
func (s *Service) RecordSessionsRevoked(ctx context.Context, userID string) {
	s.record(ctx, auth.Event{Kind: auth.EventSessionsRevoked, UserID: userID})
}

// MyProfile restituisce il profilo completo dell'utente in sessione.
func (s *Service) MyProfile(ctx context.Context, userID string) (Profile, error) {
	profile, err := s.store.Profile(ctx, userID)
	if db.IsNoRows(err) || db.IsInvalidInput(err) {
		return Profile{}, errSessionInvalid
	}
	if err != nil {
		return Profile{}, fmt.Errorf("lettura profilo: %w", err)
	}
	return profile, nil
}

// PublicProfile è ciò che gli altri utenti possono vedere: niente email, cognome o data di nascita,
// di cui si mostra solo l'età.
type PublicProfile struct {
	ID            string   `json:"id"`
	FirstName     string   `json:"firstName"`
	Age           *int     `json:"age"`
	UserType      string   `json:"userType"`
	City          string   `json:"city"`
	BudgetMax     int      `json:"budgetMax"`
	Occupation    string   `json:"occupation"`
	Bio           string   `json:"bio"`
	LifestyleTags []string `json:"lifestyleTags"`
	// Compatibility è null se chi guarda non ha una sessione o guarda il proprio profilo.
	Compatibility *Compatibility `json:"compatibility"`
}

// PublicProfile restituisce il profilo pubblico di un utente.
// Un profilo privato risulta inesistente per tutti tranne che per il proprietario.
func (s *Service) PublicProfile(ctx context.Context, viewerID, targetID string) (PublicProfile, error) {
	if !validate.MaxLen(targetID, 64) {
		return PublicProfile{}, errUserNotFound
	}
	profile, err := s.store.Profile(ctx, targetID)
	if db.IsNoRows(err) || db.IsInvalidInput(err) {
		return PublicProfile{}, errUserNotFound
	}
	if err != nil {
		return PublicProfile{}, fmt.Errorf("lettura profilo: %w", err)
	}
	if !profile.IsPublic && profile.ID != viewerID {
		return PublicProfile{}, errUserNotFound
	}

	public := PublicProfile{
		ID:            profile.ID,
		FirstName:     profile.FirstName,
		Age:           profile.Age,
		UserType:      profile.UserType,
		City:          profile.City,
		BudgetMax:     profile.BudgetMax,
		Occupation:    profile.Occupation,
		Bio:           profile.Bio,
		LifestyleTags: profile.LifestyleTags,
	}
	if viewerID != "" && viewerID != profile.ID {
		viewer, found, err := s.viewerFacts(ctx, viewerID)
		if err != nil {
			return PublicProfile{}, err
		}
		if found {
			c := compare(viewer, profileFacts{City: profile.City, BudgetMax: profile.BudgetMax, LifestyleTags: profile.LifestyleTags})
			public.Compatibility = &c
		}
	}
	return public, nil
}

// viewerFacts legge i dati di chi guarda che servono alla compatibilità.
// found è false se l'utente della sessione non esiste più.
func (s *Service) viewerFacts(ctx context.Context, viewerID string) (facts profileFacts, found bool, err error) {
	viewer, err := s.store.Profile(ctx, viewerID)
	if db.IsNoRows(err) || db.IsInvalidInput(err) {
		return profileFacts{}, false, nil
	}
	if err != nil {
		return profileFacts{}, false, fmt.Errorf("lettura profilo di chi guarda: %w", err)
	}
	return profileFacts{City: viewer.City, BudgetMax: viewer.BudgetMax, LifestyleTags: viewer.LifestyleTags}, true, nil
}

// ProfileInput sono i campi modificabili del profilo.
type ProfileInput struct {
	UserType      string   `json:"userType"`
	City          string   `json:"city"`
	BudgetMax     int      `json:"budgetMax"`
	Occupation    string   `json:"occupation"`
	Birthdate     string   `json:"birthdate"`
	Bio           string   `json:"bio"`
	LifestyleTags []string `json:"lifestyleTags"`
	IsPublic      bool     `json:"isPublic"`
}

// UpdateProfile salva il profilo e lo restituisce aggiornato.
func (s *Service) UpdateProfile(ctx context.Context, userID string, in ProfileInput) (Profile, error) {
	u := ProfileUpdate{
		UserType:   in.UserType,
		City:       validate.Text(in.City),
		BudgetMax:  in.BudgetMax,
		Occupation: in.Occupation,
		Birthdate:  in.Birthdate,
		Bio:        validate.Text(in.Bio),
		IsPublic:   in.IsPublic,
	}

	var v validate.Validator
	u.LifestyleTags = checkPersonalDetails(&v, s.now(), personalDetails{
		UserType: u.UserType, City: u.City, Birthdate: u.Birthdate, BudgetMax: u.BudgetMax,
		Occupation: u.Occupation, Bio: u.Bio, LifestyleTags: in.LifestyleTags,
	})
	if err := v.Err(); err != nil {
		return Profile{}, err
	}

	if err := s.store.UpdateProfile(ctx, userID, u); err != nil {
		return Profile{}, apperr.Wrap(err, "profile_update_failed", "Impossibile salvare il profilo")
	}
	return s.MyProfile(ctx, userID)
}

// RoommateSummary è un profilo nell'elenco dei coinquilini.
type RoommateSummary struct {
	ID            string   `json:"id"`
	FirstName     string   `json:"firstName"`
	Age           *int     `json:"age"`
	City          string   `json:"city"`
	Occupation    string   `json:"occupation"`
	Bio           string   `json:"bio"`
	LifestyleTags []string `json:"lifestyleTags"`
	BudgetMax     int      `json:"budgetMax"`
	// Compatibility è null se chi guarda non ha una sessione.
	Compatibility *Compatibility `json:"compatibility"`
}

// RoommatesPage è una pagina dell'elenco; NextCursor è null se non ci sono altri profili.
type RoommatesPage struct {
	Items      []RoommateSummary `json:"items"`
	NextCursor *string           `json:"nextCursor"`
}

// RoommatesParams sono i parametri della richiesta, come arrivano nell'URL.
type RoommatesParams struct {
	City, MinBudget, Cursor, Limit string
}

// Roommates restituisce una pagina dei profili pubblici di chi cerca una stanza (anomalia F18),
// escluso chi guarda.
func (s *Service) Roommates(ctx context.Context, viewerID string, p RoommatesParams) (RoommatesPage, error) {
	q := RoommatesQuery{ExcludeID: viewerID, City: p.City, Limit: roommatesDefaultLimit}

	var v validate.Validator
	v.Check(q.City == "" || shared.IsCity(q.City), "city", "Città non valida")
	if p.MinBudget != "" {
		minBudget, err := strconv.Atoi(p.MinBudget)
		v.Check(err == nil && validate.Between(minBudget, 1, 20000), "minBudget", "Il budget deve essere compreso tra 1 e 20.000 €")
		q.MinBudget = minBudget
	}
	if p.Limit != "" {
		limit, err := strconv.Atoi(p.Limit)
		ok := err == nil && validate.Between(limit, 1, roommatesMaxLimit)
		v.Check(ok, "limit", fmt.Sprintf("Il numero di profili per pagina deve essere tra 1 e %d", roommatesMaxLimit))
		q.Limit = limit
	}
	if p.Cursor != "" {
		after, ok := decodeRoommatesCursor(p.Cursor)
		v.Check(ok, "cursor", "Pagina non valida: ricarica l'elenco")
		q.After = &after
	}
	if err := v.Err(); err != nil {
		return RoommatesPage{}, err
	}

	// Un profilo in più dice se esiste la pagina successiva
	limit := q.Limit
	q.Limit++
	rows, err := s.store.Roommates(ctx, q)
	if err != nil {
		return RoommatesPage{}, fmt.Errorf("elenco coinquilini: %w", err)
	}

	result := RoommatesPage{Items: make([]RoommateSummary, 0, min(len(rows), limit))}
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[limit-1]
		cursor := encodeRoommatesCursor(RoommatesCursor{CreatedAt: last.CreatedAt, ID: last.ID})
		result.NextCursor = &cursor
	}

	var viewer profileFacts
	var withCompatibility bool
	if viewerID != "" {
		viewer, withCompatibility, err = s.viewerFacts(ctx, viewerID)
		if err != nil {
			return RoommatesPage{}, err
		}
	}

	for _, r := range rows {
		item := RoommateSummary{
			ID:            r.ID,
			FirstName:     r.FirstName,
			Age:           r.Age,
			City:          r.City,
			Occupation:    r.Occupation,
			Bio:           r.Bio,
			LifestyleTags: r.LifestyleTags,
			BudgetMax:     r.BudgetMax,
		}
		if withCompatibility {
			c := compare(viewer, profileFacts{City: r.City, BudgetMax: r.BudgetMax, LifestyleTags: r.LifestyleTags})
			item.Compatibility = &c
		}
		result.Items = append(result.Items, item)
	}
	return result, nil
}

// Il cursore contiene la data di creazione dell'ultimo profilo mostrato (vuota se manca) e il suo ID.
func encodeRoommatesCursor(c RoommatesCursor) string {
	created := ""
	if c.CreatedAt != nil {
		created = c.CreatedAt.UTC().Format(time.RFC3339Nano)
	}
	return page.Encode(created, c.ID)
}

func decodeRoommatesCursor(cursor string) (RoommatesCursor, bool) {
	fields, ok := page.Decode(cursor, 2)
	if !ok || !uuidPattern.MatchString(fields[1]) {
		return RoommatesCursor{}, false
	}
	c := RoommatesCursor{ID: fields[1]}
	if fields[0] != "" {
		created, err := time.Parse(time.RFC3339Nano, fields[0])
		if err != nil {
			return RoommatesCursor{}, false
		}
		c.CreatedAt = &created
	}
	return c, true
}

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// checkSecret controlla ciò che arriva al posto della password.
//
// Con il metodo nuovo il server riceve una chiave derivata, non la password: le regole su
// lunghezza e password prevedibili le applica il browser, l'unico che la vede (src/auth/passwordPolicy.ts).
// Qui resta la verifica della forma. Per gli account non ancora aggiornati vale ancora il controllo completo.
func checkSecret(v *validate.Validator, field, secret string, kdf auth.KDFParams, email, firstName string) {
	if kdf.Version == auth.KDFDerived {
		v.Check(secret != "" && validate.Base64(secret, 128), field, "Chiave di accesso non valida")
		return
	}
	if problem := auth.PasswordProblem(secret, email, firstName); problem != "" {
		v.Check(false, field, problem)
	}
}

// checkKDF controlla i parametri di derivazione dichiarati dal browser.
func checkKDF(v *validate.Validator, kdf auth.KDFParams) {
	v.Check(kdf.Version == auth.KDFDerived, "kdf", "Aggiorna la pagina: il metodo di accesso è cambiato")
	if kdf.Version != auth.KDFDerived {
		return
	}
	v.Check(validate.Base64(kdf.Salt, 128) && len(kdf.Salt) >= 16, "kdf", "Parametri di sicurezza non validi")
	v.Check(kdf.Iterations >= auth.MinKDFIterations && kdf.Iterations <= 10_000_000, "kdf", "Parametri di sicurezza non validi")
}

// personalDetails sono i campi comuni a registrazione e modifica del profilo.
type personalDetails struct {
	UserType, City, Birthdate string
	BudgetMax                 int
	Occupation, Bio           string
	LifestyleTags             []string
}

// checkPersonalDetails valida i campi comuni a registrazione e modifica del profilo e restituisce
// le abitudini senza duplicati, nell'ordine dell'elenco. Città e occupazione sono facoltative,
// ma se indicate devono essere tra quelle di shared/options.json.
func checkPersonalDetails(v *validate.Validator, now time.Time, d personalDetails) []string {
	v.Check(validate.OneOf(d.UserType, UserTypeSeeker, UserTypeLandlord), "userType", "Tipo di utente non valido")
	v.Check(d.City == "" || shared.IsCity(d.City), "city", "Scegli la città dall'elenco")
	v.Check(validate.PastDate(d.Birthdate, now), "birthdate", "Data di nascita non valida")
	v.Check(validate.Between(d.BudgetMax, 0, 20000), "budgetMax", "Il budget deve essere compreso tra 0 e 20.000 €")
	v.Check(d.Occupation == "" || shared.HasKey(shared.Occupations, d.Occupation), "occupation", "Occupazione non valida")
	v.Check(validate.MaxLen(d.Bio, 1000), "bio", "La bio può avere al massimo 1000 caratteri")

	tags, ok := shared.NormalizeKeys(shared.LifestyleTags, d.LifestyleTags)
	v.Check(ok, "lifestyleTags", "Abitudine non valida")
	v.Check(!slices.Contains(tags, tagSmoker) || !slices.Contains(tags, tagNonSmoker), "lifestyleTags",
		"Scegli solo una tra «Fumatore» e «Non fumatore»")
	return tags
}

// checkVault valida la chiave pubblica e la chiave privata cifrata: tutte presenti o tutte assenti.
func checkVault(v *validate.Validator, vault Vault) {
	fields := []string{vault.PublicKey, vault.EncryptedPrivateKey, vault.CryptoSalt, vault.CryptoIV}
	present := 0
	for _, f := range fields {
		if f != "" {
			present++
		}
	}
	if present == 0 {
		return
	}
	v.Check(present == len(fields) &&
		validate.Base64(vault.PublicKey, 1024) &&
		validate.Base64(vault.EncryptedPrivateKey, 4096) &&
		validate.Base64(vault.CryptoSalt, 64) &&
		validate.Base64(vault.CryptoIV, 64),
		"keys", "Chiavi di cifratura non valide")
}
