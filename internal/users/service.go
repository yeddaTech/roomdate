package users

import (
	"context"
	"fmt"
	"strings"
	"time"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/db"
	"roomdate-backend/internal/validate"
)

// Tipi di utente ammessi.
const (
	UserTypeSeeker   = "cerca"
	UserTypeLandlord = "affitta"
)

const roommatesLimit = 8

var (
	errSessionInvalid = apperr.Unauthorized("session_invalid", "Sessione scaduta: accedi di nuovo")
	errLocked         = apperr.TooManyRequests("account_locked", "Account temporaneamente bloccato per troppi tentativi. Riprova tra 15 minuti.")
	errTooManyFailed  = apperr.TooManyRequests("account_locked", "Troppi tentativi falliti. Account bloccato per 15 minuti.")
	errUserNotFound   = apperr.NotFound("user_not_found", "Utente non trovato")
)

type Service struct {
	store *Store
	now   func() time.Time
}

func NewService(store *Store) *Service {
	return &Service{store: store, now: time.Now}
}

// RegisterInput sono i dati del modulo di registrazione.
type RegisterInput struct {
	FirstName     string `json:"firstName"`
	LastName      string `json:"lastName"`
	Email         string `json:"email"`
	Password      string `json:"password"`
	City          string `json:"city"`
	UserType      string `json:"userType"`
	Birthdate     string `json:"birthdate"`
	BudgetMax     int    `json:"budgetMax"`
	Occupation    string `json:"occupation"`
	Bio           string `json:"bio"`
	LifestyleTags string `json:"lifestyleTags"`
	Keys          *Vault `json:"keys"`
}

// Register crea l'account e restituisce l'ID del nuovo utente.
func (s *Service) Register(ctx context.Context, in RegisterInput) (string, error) {
	u := NewUser{
		FirstName:     validate.CleanText(in.FirstName),
		LastName:      validate.CleanText(in.LastName),
		Email:         strings.TrimSpace(in.Email),
		City:          validate.CleanText(in.City),
		UserType:      in.UserType,
		Birthdate:     in.Birthdate,
		BudgetMax:     in.BudgetMax,
		Occupation:    validate.CleanText(in.Occupation),
		Bio:           validate.CleanText(in.Bio),
		LifestyleTags: validate.CleanText(in.LifestyleTags),
	}
	if in.Keys != nil {
		u.Vault = *in.Keys
	}

	var v validate.Validator
	v.Check(validate.NotBlank(u.FirstName) && validate.MaxLen(u.FirstName, 50), "firstName", "Il nome è obbligatorio (massimo 50 caratteri)")
	v.Check(validate.NotBlank(u.LastName) && validate.MaxLen(u.LastName, 50), "lastName", "Il cognome è obbligatorio (massimo 50 caratteri)")
	v.Check(validate.Email(u.Email), "email", "Inserisci un indirizzo email valido")
	checkPassword(&v, "password", in.Password)
	checkPersonalDetails(&v, s.now(), u.UserType, u.City, u.Birthdate, u.BudgetMax, u.Occupation, u.Bio, u.LifestyleTags)
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

// Login verifica le credenziali, con blocco temporaneo dopo troppi tentativi errati.
func (s *Service) Login(ctx context.Context, email, password string) (Account, error) {
	account, err := s.store.AccountByEmail(ctx, email)
	if db.IsNoRows(err) {
		return Account{}, apperr.Unauthorized("invalid_credentials", "Email non trovata")
	}
	if err != nil {
		return Account{}, fmt.Errorf("lettura account: %w", err)
	}
	if err := s.verifyPassword(ctx, account, password, "Password errata"); err != nil {
		return Account{}, err
	}
	return account, nil
}

// verifyPassword controlla la password rispettando il blocco dell'account: ogni errore aumenta
// il contatore e al quinto l'account resta bloccato per 15 minuti. Un successo azzera il contatore.
func (s *Service) verifyPassword(ctx context.Context, account Account, password, wrongMessage string) error {
	if account.LockedUntil != nil && account.LockedUntil.After(s.now()) {
		return errLocked
	}

	if !auth.CheckPassword(account.PasswordHash, password) {
		attempts := account.FailedLogins + 1
		lock := attempts >= auth.MaxFailedLogins
		if err := s.store.SetFailedLogins(ctx, account.ID, attempts, lock, auth.LockDuration); err != nil {
			return fmt.Errorf("aggiornamento tentativi: %w", err)
		}
		if lock {
			return errTooManyFailed
		}
		return apperr.Unauthorized("invalid_credentials", wrongMessage)
	}

	if account.FailedLogins > 0 {
		if err := s.store.ResetFailedLogins(ctx, account.ID); err != nil {
			return fmt.Errorf("azzeramento tentativi: %w", err)
		}
	}
	return nil
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
}

// ChangePassword richiede la password attuale e, se l'utente ha chiavi E2EE, la chiave privata
// cifrata di nuovo con la nuova password: senza, i messaggi diventerebbero illeggibili.
func (s *Service) ChangePassword(ctx context.Context, userID string, in ChangePasswordInput) error {
	var v validate.Validator
	v.Check(len(in.NewPassword) >= auth.MinPasswordLength, "newPassword", "La nuova password deve avere almeno 6 caratteri")
	v.Check(len(in.NewPassword) <= auth.MaxPasswordBytes, "newPassword", "La nuova password è troppo lunga")
	if err := v.Err(); err != nil {
		return err
	}

	account, err := s.store.AccountByID(ctx, userID)
	if db.IsNoRows(err) || db.IsInvalidInput(err) {
		return errSessionInvalid
	}
	if err != nil {
		return fmt.Errorf("lettura account: %w", err)
	}
	if account.LockedUntil != nil && account.LockedUntil.After(s.now()) {
		return errLocked
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

	if err := s.verifyPassword(ctx, account, in.CurrentPassword, "La password attuale non è corretta"); err != nil {
		return err
	}

	hash, err := auth.HashPassword(in.NewPassword)
	if err != nil {
		return fmt.Errorf("hash della password: %w", err)
	}
	if err := s.store.UpdatePassword(ctx, userID, hash, newVault); err != nil {
		return fmt.Errorf("aggiornamento password: %w", err)
	}
	return nil
}

// DeleteAccount elimina l'utente.
func (s *Service) DeleteAccount(ctx context.Context, userID string) error {
	if err := s.store.Delete(ctx, userID); err != nil {
		return apperr.Wrap(err, "delete_failed", "Impossibile eliminare l'account in questo momento")
	}
	return nil
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

// PublicProfile è ciò che gli altri utenti possono vedere: niente email, cognome o data di nascita.
type PublicProfile struct {
	ID            string `json:"id"`
	FirstName     string `json:"firstName"`
	UserType      string `json:"userType"`
	City          string `json:"city"`
	BudgetMax     int    `json:"budgetMax"`
	Occupation    string `json:"occupation"`
	Bio           string `json:"bio"`
	LifestyleTags string `json:"lifestyleTags"`
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
	return PublicProfile{
		ID:            profile.ID,
		FirstName:     profile.FirstName,
		UserType:      profile.UserType,
		City:          profile.City,
		BudgetMax:     profile.BudgetMax,
		Occupation:    profile.Occupation,
		Bio:           profile.Bio,
		LifestyleTags: profile.LifestyleTags,
	}, nil
}

// ProfileInput sono i campi modificabili del profilo.
type ProfileInput struct {
	UserType      string `json:"userType"`
	City          string `json:"city"`
	BudgetMax     int    `json:"budgetMax"`
	Occupation    string `json:"occupation"`
	Birthdate     string `json:"birthdate"`
	Bio           string `json:"bio"`
	LifestyleTags string `json:"lifestyleTags"`
	IsPublic      bool   `json:"isPublic"`
}

// UpdateProfile salva il profilo e lo restituisce aggiornato.
func (s *Service) UpdateProfile(ctx context.Context, userID string, in ProfileInput) (Profile, error) {
	u := ProfileUpdate{
		UserType:      in.UserType,
		City:          validate.CleanText(in.City),
		BudgetMax:     in.BudgetMax,
		Occupation:    validate.CleanText(in.Occupation),
		Birthdate:     in.Birthdate,
		Bio:           validate.CleanText(in.Bio),
		LifestyleTags: validate.CleanText(in.LifestyleTags),
		IsPublic:      in.IsPublic,
	}

	var v validate.Validator
	checkPersonalDetails(&v, s.now(), u.UserType, u.City, u.Birthdate, u.BudgetMax, u.Occupation, u.Bio, u.LifestyleTags)
	if err := v.Err(); err != nil {
		return Profile{}, err
	}

	if err := s.store.UpdateProfile(ctx, userID, u); err != nil {
		return Profile{}, apperr.Wrap(err, "profile_update_failed", "Impossibile salvare il profilo")
	}
	return s.MyProfile(ctx, userID)
}

// Roommate è un profilo nell'elenco dei coinquilini (formato JSON delle API legacy).
// Età e compatibilità reali arrivano con il modulo M1.5.
type Roommate struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Job      string   `json:"job"`
	Quote    string   `json:"quote"`
	City     string   `json:"city"`
	Color1   string   `json:"color1"`
	Color2   string   `json:"color2"`
	Emoji    string   `json:"emoji"`
	Tags     []string `json:"tags"`
	UserType string   `json:"user_type"`
	Budget   int      `json:"budget_max"`
}

// Roommates restituisce i profili pubblici, con i soli dati inseriti dagli utenti.
// Colori ed emoji dell'avatar sono decorativi.
func (s *Service) Roommates(ctx context.Context) ([]Roommate, error) {
	rows, err := s.store.PublicRoommates(ctx, roommatesLimit)
	if err != nil {
		return nil, fmt.Errorf("elenco coinquilini: %w", err)
	}

	colors := [][]string{{"#F5C29A", "#C4603A"}, {"#C4A882", "#7A4B2A"}, {"#D4B896", "#9A4628"}, {"#EAF3DE", "#4CAF50"}}
	emojis := []string{"👩", "👨", "👩‍🎓", "👨‍🎨"}

	roommates := make([]Roommate, 0, len(rows))
	for i, row := range rows {
		tags := []string{}
		if row.Tags != "" {
			tags = strings.Split(row.Tags, ", ")
		}
		roommates = append(roommates, Roommate{
			ID:       row.ID,
			Name:     row.Name,
			Job:      row.Job,
			Quote:    row.Bio,
			City:     row.City,
			Color1:   colors[i%len(colors)][0],
			Color2:   colors[i%len(colors)][1],
			Emoji:    emojis[i%len(emojis)],
			Tags:     tags,
			UserType: row.UserType,
			Budget:   row.BudgetMax,
		})
	}
	return roommates, nil
}

func checkPassword(v *validate.Validator, field, password string) {
	v.Check(len(password) >= auth.MinPasswordLength, field, "La password deve avere almeno 6 caratteri")
	v.Check(len(password) <= auth.MaxPasswordBytes, field, "La password è troppo lunga")
}

// checkPersonalDetails valida i campi comuni a registrazione e modifica del profilo.
// Occupazione e città sono ancora testo libero: diventano elenchi chiusi nel modulo M1.5.
func checkPersonalDetails(v *validate.Validator, now time.Time, userType, city, birthdate string, budget int, occupation, bio, tags string) {
	v.Check(validate.OneOf(userType, UserTypeSeeker, UserTypeLandlord), "userType", "Tipo di utente non valido")
	v.Check(validate.MaxLen(city, 80), "city", "La città può avere al massimo 80 caratteri")
	v.Check(validate.PastDate(birthdate, now), "birthdate", "Data di nascita non valida")
	v.Check(validate.Between(budget, 0, 20000), "budgetMax", "Il budget deve essere compreso tra 0 e 20.000 €")
	v.Check(validate.MaxLen(occupation, 50), "occupation", "L'occupazione può avere al massimo 50 caratteri")
	v.Check(validate.MaxLen(bio, 1000), "bio", "La bio può avere al massimo 1000 caratteri")
	v.Check(validate.MaxLen(tags, 300), "lifestyleTags", "Troppi tag di stile di vita")
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
