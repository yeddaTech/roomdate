// Package users gestisce account, accesso e profili degli utenti.
package users

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store esegue le query sulla tabella roomdate_app.users.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// Account contiene i dati necessari all'accesso.
type Account struct {
	ID, FirstName, LastName, Email, UserType string
	PasswordHash                             string
	Vault                                    Vault
	FailedLogins                             int
	LockedUntil                              *time.Time
}

// Vault è la chiave privata E2EE cifrata con la password dell'utente, più la chiave pubblica.
type Vault struct {
	PublicKey           string `json:"publicKey"`
	EncryptedPrivateKey string `json:"encryptedPrivateKey"`
	CryptoSalt          string `json:"cryptoSalt"`
	CryptoIV            string `json:"cryptoIv"`
}

const accountColumns = `id::text, COALESCE(first_name, ''), COALESCE(last_name, ''), email, COALESCE(user_type, ''), password_hash,
    COALESCE(public_key, ''), COALESCE(encrypted_private_key, ''), COALESCE(crypto_salt, ''), COALESCE(crypto_iv, ''),
    COALESCE(failed_login_attempts, 0), locked_until`

func scanAccount(row interface{ Scan(...any) error }) (Account, error) {
	var a Account
	err := row.Scan(&a.ID, &a.FirstName, &a.LastName, &a.Email, &a.UserType, &a.PasswordHash,
		&a.Vault.PublicKey, &a.Vault.EncryptedPrivateKey, &a.Vault.CryptoSalt, &a.Vault.CryptoIV,
		&a.FailedLogins, &a.LockedUntil)
	return a, err
}

// AccountByEmail cerca l'account ignorando le maiuscole (usa l'indice users_email_lower_key).
func (s *Store) AccountByEmail(ctx context.Context, email string) (Account, error) {
	return scanAccount(s.db.QueryRow(ctx, `SELECT `+accountColumns+` FROM roomdate_app.users WHERE lower(email) = lower($1)`, email))
}

func (s *Store) AccountByID(ctx context.Context, id string) (Account, error) {
	return scanAccount(s.db.QueryRow(ctx, `SELECT `+accountColumns+` FROM roomdate_app.users WHERE id = $1`, id))
}

// SetFailedLogins aggiorna il contatore dei tentativi falliti; se lock è true blocca l'account.
func (s *Store) SetFailedLogins(ctx context.Context, id string, attempts int, lock bool, lockFor time.Duration) error {
	_, err := s.db.Exec(ctx, `
        UPDATE roomdate_app.users
        SET failed_login_attempts = $2,
            locked_until = CASE WHEN $3 THEN NOW() + make_interval(secs => $4) ELSE locked_until END
        WHERE id = $1`, id, attempts, lock, lockFor.Seconds())
	return err
}

func (s *Store) ResetFailedLogins(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `UPDATE roomdate_app.users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, id)
	return err
}

// NewUser contiene i dati di registrazione già validati e ripuliti.
type NewUser struct {
	FirstName, LastName, Email, PasswordHash string
	City, UserType, Birthdate                string
	BudgetMax                                int
	Occupation, Bio                          string
	LifestyleTags                            []string
	Vault                                    Vault
}

// Create inserisce l'utente. Città e occupazione vuote diventano NULL.
func (s *Store) Create(ctx context.Context, u NewUser) (string, error) {
	var id string
	err := s.db.QueryRow(ctx, `
        INSERT INTO roomdate_app.users
            (first_name, last_name, email, password_hash, citta, user_type, birthdate, budget_max,
             occupation, bio, lifestyle_tags, public_key, encrypted_private_key, crypto_salt, crypto_iv)
        VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, $8, NULLIF($9, ''), $10, $11, $12, $13, $14, $15)
        RETURNING id::text`,
		u.FirstName, u.LastName, u.Email, u.PasswordHash, u.City, u.UserType, u.Birthdate, u.BudgetMax,
		u.Occupation, u.Bio, u.LifestyleTags,
		u.Vault.PublicKey, u.Vault.EncryptedPrivateKey, u.Vault.CryptoSalt, u.Vault.CryptoIV,
	).Scan(&id)
	return id, err
}

// UpdatePassword cambia password e chiave privata cifrata in un'unica istruzione.
// La chiave viene sostituita solo se l'utente ne aveva già una.
func (s *Store) UpdatePassword(ctx context.Context, id, passwordHash string, vault Vault) error {
	_, err := s.db.Exec(ctx, `
        UPDATE roomdate_app.users
        SET password_hash = $2,
            encrypted_private_key = CASE WHEN COALESCE(encrypted_private_key, '') <> '' THEN $3 ELSE encrypted_private_key END,
            crypto_salt = CASE WHEN COALESCE(encrypted_private_key, '') <> '' THEN $4 ELSE crypto_salt END,
            crypto_iv = CASE WHEN COALESCE(encrypted_private_key, '') <> '' THEN $5 ELSE crypto_iv END,
            failed_login_attempts = 0,
            locked_until = NULL
        WHERE id = $1`,
		id, passwordHash, vault.EncryptedPrivateKey, vault.CryptoSalt, vault.CryptoIV)
	return err
}

// Delete elimina l'utente e restituisce le chiavi delle foto dei suoi annunci, da cancellare dallo storage.
// Il database elimina a cascata gli annunci; conversazioni e messaggi restano all'altro partecipante.
// La copia dei messaggi cifrata per l'utente eliminato non serve più a nessuno e viene cancellata.
func (s *Store) Delete(ctx context.Context, id string) ([]string, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
        SELECT i.storage_key
        FROM roomdate_app.listing_images i
        JOIN roomdate_app.listings l ON i.listing_id = l.id
        WHERE l.user_id = $1`, id)
	if err != nil {
		return nil, err
	}
	keys, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE roomdate_app.messages SET sender_content = NULL WHERE sender_id = $1`, id); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM roomdate_app.users WHERE id = $1`, id); err != nil {
		return nil, err
	}
	return keys, tx.Commit(ctx)
}

// Profile è il profilo completo, visibile solo al proprietario.
type Profile struct {
	ID            string   `json:"id"`
	FirstName     string   `json:"firstName"`
	LastName      string   `json:"lastName"`
	Email         string   `json:"email"`
	UserType      string   `json:"userType"`
	City          string   `json:"city"`
	Birthdate     string   `json:"birthdate"`
	BudgetMax     int      `json:"budgetMax"`
	Occupation    string   `json:"occupation"`
	Bio           string   `json:"bio"`
	LifestyleTags []string `json:"lifestyleTags"`
	IsPublic      bool     `json:"isPublic"`
	// Age è calcolata dal database; nil se manca la data di nascita. Il proprietario vede già la data.
	Age *int `json:"-"`
}

// ageColumn calcola l'età in anni compiuti, così la data di nascita non esce dal database.
const ageColumn = `EXTRACT(YEAR FROM age(CURRENT_DATE, birthdate))::int`

func (s *Store) Profile(ctx context.Context, id string) (Profile, error) {
	var p Profile
	err := s.db.QueryRow(ctx, `
        SELECT id::text, COALESCE(first_name, ''), COALESCE(last_name, ''), email,
               COALESCE(user_type, ''), COALESCE(citta, ''), COALESCE(birthdate::text, ''),
               COALESCE(budget_max, 0), COALESCE(occupation, ''), COALESCE(bio, ''), lifestyle_tags,
               COALESCE(is_public, true), `+ageColumn+`
        FROM roomdate_app.users WHERE id = $1`, id,
	).Scan(&p.ID, &p.FirstName, &p.LastName, &p.Email, &p.UserType, &p.City, &p.Birthdate,
		&p.BudgetMax, &p.Occupation, &p.Bio, &p.LifestyleTags, &p.IsPublic, &p.Age)
	return p, err
}

// ProfileUpdate contiene i campi modificabili del profilo, già validati e ripuliti.
type ProfileUpdate struct {
	UserType, City        string
	BudgetMax             int
	Occupation, Birthdate string
	Bio                   string
	LifestyleTags         []string
	IsPublic              bool
}

func (s *Store) UpdateProfile(ctx context.Context, id string, u ProfileUpdate) error {
	_, err := s.db.Exec(ctx, `
        UPDATE roomdate_app.users
        SET user_type = $2, citta = NULLIF($3, ''), budget_max = $4, occupation = NULLIF($5, ''), birthdate = $6,
            bio = $7, lifestyle_tags = $8, is_public = $9
        WHERE id = $1`,
		id, u.UserType, u.City, u.BudgetMax, u.Occupation, u.Birthdate, u.Bio, u.LifestyleTags, u.IsPublic)
	return err
}

// RoommateRow è un profilo nell'elenco dei coinquilini.
type RoommateRow struct {
	ID, FirstName, City, Occupation, Bio string
	Age                                  *int
	LifestyleTags                        []string
	BudgetMax                            int
	CreatedAt                            time.Time
}

// RoommatesQuery filtra e pagina l'elenco dei coinquilini.
type RoommatesQuery struct {
	// ExcludeID è l'utente che guarda (vuoto se non ha una sessione): non vede sé stesso.
	ExcludeID string
	// City vuota significa tutte le città.
	City string
	// After è la posizione dell'ultimo profilo della pagina precedente, nil per la prima pagina.
	After *RoommatesCursor
	Limit int
}

// RoommatesCursor è la posizione di un profilo nell'ordinamento dell'elenco.
type RoommatesCursor struct {
	CreatedAt time.Time
	ID        string
}

// Roommates restituisce i profili pubblici di chi cerca una stanza, dal più recente.
// Gli account senza data di creazione (possibili in produzione) vengono per ultimi.
func (s *Store) Roommates(ctx context.Context, q RoommatesQuery) ([]RoommateRow, error) {
	var afterTime *time.Time
	var afterID string
	if q.After != nil {
		afterTime, afterID = &q.After.CreatedAt, q.After.ID
	}
	rows, err := s.db.Query(ctx, `
        SELECT id::text, COALESCE(first_name, ''), COALESCE(citta, ''), COALESCE(occupation, ''), COALESCE(bio, ''),
               `+ageColumn+`, lifestyle_tags, COALESCE(budget_max, 0), COALESCE(created_at, 'epoch')
        FROM roomdate_app.users
        WHERE COALESCE(is_public, true)
          AND user_type = 'cerca'
          AND ($1 = '' OR id <> NULLIF($1, '')::uuid)
          AND ($2 = '' OR citta = $2)
          AND ($3::timestamptz IS NULL OR (COALESCE(created_at, 'epoch'), id) < ($3::timestamptz, NULLIF($4, '')::uuid))
        ORDER BY COALESCE(created_at, 'epoch') DESC, id DESC
        LIMIT $5`,
		q.ExcludeID, q.City, afterTime, afterID, q.Limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (RoommateRow, error) {
		var r RoommateRow
		err := row.Scan(&r.ID, &r.FirstName, &r.City, &r.Occupation, &r.Bio, &r.Age, &r.LifestyleTags, &r.BudgetMax, &r.CreatedAt)
		return r, err
	})
}
