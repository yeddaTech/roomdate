package auth

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"roomdate-backend/internal/db"
)

// Store esegue le query su sessioni e registro di sicurezza.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// NewSession sono i dati di una sessione da creare.
type NewSession struct {
	UserID    string
	TokenHash string
	ExpiresAt time.Time
	UserAgent string
}

// StoredSession è una sessione salvata.
type StoredSession struct {
	ID         string    `json:"id"`
	UserID     string    `json:"-"`
	CreatedAt  time.Time `json:"createdAt"`
	LastUsedAt time.Time `json:"lastUsedAt"`
	ExpiresAt  time.Time `json:"-"`
	Device     string    `json:"device"`
}

// CreateSession salva la nuova sessione ed elimina quelle scadute dello stesso utente.
func (s *Store) CreateSession(ctx context.Context, n NewSession) error {
	_, err := s.db.Exec(ctx, `
        INSERT INTO roomdate_app.sessions (user_id, token_hash, expires_at, user_agent)
        VALUES ($1, $2, $3, $4)`, n.UserID, n.TokenHash, n.ExpiresAt, n.UserAgent)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `
        DELETE FROM roomdate_app.sessions
        WHERE user_id = $1 AND (expires_at < NOW() OR last_used_at < NOW() - $2::interval)`,
		n.UserID, SessionIdleDuration.String())
	return err
}

// SessionByHash cerca la sessione dall'impronta del token; pgx.ErrNoRows se non esiste.
func (s *Store) SessionByHash(ctx context.Context, tokenHash string) (StoredSession, error) {
	var stored StoredSession
	err := s.db.QueryRow(ctx, `
        SELECT id::text, user_id::text, created_at, last_used_at, expires_at, COALESCE(user_agent, '')
        FROM roomdate_app.sessions WHERE token_hash = $1`, tokenHash,
	).Scan(&stored.ID, &stored.UserID, &stored.CreatedAt, &stored.LastUsedAt, &stored.ExpiresAt, &stored.Device)
	return stored, err
}

// TouchSession aggiorna l'ultimo utilizzo della sessione.
func (s *Store) TouchSession(ctx context.Context, id string, at time.Time) error {
	_, err := s.db.Exec(ctx, `UPDATE roomdate_app.sessions SET last_used_at = $2 WHERE id = $1`, id, at)
	return err
}

// SessionsFor restituisce le sessioni ancora valide dell'utente, dalla più usata di recente.
func (s *Store) SessionsFor(ctx context.Context, userID string, now time.Time, idle time.Duration) ([]StoredSession, error) {
	rows, err := s.db.Query(ctx, `
        SELECT id::text, user_id::text, created_at, last_used_at, expires_at, COALESCE(user_agent, '')
        FROM roomdate_app.sessions
        WHERE user_id = $1 AND expires_at > $2 AND last_used_at > $2 - $3::interval
        ORDER BY last_used_at DESC`, userID, now, idle.String())
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (StoredSession, error) {
		var stored StoredSession
		err := row.Scan(&stored.ID, &stored.UserID, &stored.CreatedAt, &stored.LastUsedAt, &stored.ExpiresAt, &stored.Device)
		return stored, err
	})
}

func (s *Store) DeleteSession(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM roomdate_app.sessions WHERE id = $1`, id)
	return err
}

// DeleteUserSession revoca una sessione dell'utente; ok è false se non era sua, non esiste
// o l'identificativo non ha la forma giusta.
func (s *Store) DeleteUserSession(ctx context.Context, userID, sessionID string) (bool, error) {
	tag, err := s.db.Exec(ctx, `
        DELETE FROM roomdate_app.sessions WHERE user_id = $1 AND id = $2::uuid`, userID, sessionID)
	if db.IsInvalidInput(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// DeleteUserSessions revoca tutte le sessioni dell'utente tranne quella indicata.
func (s *Store) DeleteUserSessions(ctx context.Context, userID, keepSessionID string) (int, error) {
	tag, err := s.db.Exec(ctx, `
        DELETE FROM roomdate_app.sessions WHERE user_id = $1 AND id <> $2::uuid`, userID, keepSessionID)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

// Tipi di evento registrati.
const (
	EventLoginOK         = "login_ok"
	EventLoginFailed     = "login_failed"
	EventPasswordChanged = "password_changed"
	EventAccountDeleted  = "account_deleted"
	EventSessionsRevoked = "sessions_revoked"
)

// Event è una riga del registro di sicurezza. UserID è vuoto per i tentativi su email inesistenti.
type Event struct {
	Kind      string
	UserID    string
	EmailHash string
	IPHash    string
}

// RecordEvent salva un evento di sicurezza.
func (s *Store) RecordEvent(ctx context.Context, e Event) error {
	_, err := s.db.Exec(ctx, `
        INSERT INTO roomdate_app.security_events (kind, user_id, email_hash, ip_hash)
        VALUES ($1, NULLIF($2, '')::uuid, NULLIF($3, ''), NULLIF($4, ''))`,
		e.Kind, e.UserID, e.EmailHash, e.IPHash)
	return err
}

// FailedLogins conta i tentativi falliti recenti e dice quando è avvenuto l'ultimo,
// per email e per indirizzo di provenienza.
type FailedLogins struct {
	ByEmail, ByIP int
	LastAttempt   time.Time
}

func (s *Store) RecentFailedLogins(ctx context.Context, emailHash, ipHash string, window time.Duration) (FailedLogins, error) {
	var f FailedLogins
	var last *time.Time
	err := s.db.QueryRow(ctx, `
        SELECT count(*) FILTER (WHERE email_hash = $1),
               count(*) FILTER (WHERE ip_hash = $2 AND $2 <> ''),
               max(created_at)
        FROM roomdate_app.security_events
        WHERE kind = 'login_failed'
          AND created_at > NOW() - $3::interval
          AND (email_hash = $1 OR (ip_hash = $2 AND $2 <> ''))`,
		emailHash, ipHash, window.String()).Scan(&f.ByEmail, &f.ByIP, &last)
	if last != nil {
		f.LastAttempt = *last
	}
	return f, err
}

// EventRetention è per quanto si conservano gli eventi del registro di sicurezza (vedi informativa privacy).
const EventRetention = 90 * 24 * time.Hour

// DeleteOldEvents elimina gli eventi più vecchi del periodo di conservazione.
func (s *Store) DeleteOldEvents(ctx context.Context, keepFor time.Duration) error {
	_, err := s.db.Exec(ctx, `DELETE FROM roomdate_app.security_events WHERE created_at < NOW() - $1::interval`, keepFor.String())
	return err
}
