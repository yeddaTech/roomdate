// Package push gestisce le notifiche push dei messaggi (modulo M2.8): le iscrizioni dei browser e
// l'invio quando arriva un messaggio, anche a sito chiuso. La notifica dice solo chi ha scritto:
// il testo è cifrato end-to-end e il server non lo conosce.
package push

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"roomdate-backend/internal/webpush"
)

// Iscrizioni al massimo per utente (una per browser): le più vecchie lasciano il posto.
const maxPerUser = 10

// Store salva le iscrizioni.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// Save registra l'iscrizione del browser per la sessione. Se l'indirizzo c'era già (lo stesso
// browser, magari con un altro account) passa a questa sessione.
func (s *Store) Save(ctx context.Context, userID, sessionID string, sub webpush.Subscription) error {
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `
            INSERT INTO roomdate_app.push_subscriptions (user_id, session_id, endpoint, p256dh, auth)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (endpoint) DO UPDATE
            SET user_id = EXCLUDED.user_id, session_id = EXCLUDED.session_id,
                p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, created_at = now()`,
			userID, sessionID, sub.Endpoint, sub.P256dh, sub.Auth); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
            DELETE FROM roomdate_app.push_subscriptions
            WHERE user_id = $1 AND id NOT IN (
                SELECT id FROM roomdate_app.push_subscriptions WHERE user_id = $1
                ORDER BY created_at DESC, id DESC LIMIT $2)`, userID, maxPerUser)
		return err
	})
}

// Delete cancella l'iscrizione dell'utente con quell'indirizzo, se c'è.
func (s *Store) Delete(ctx context.Context, userID, endpoint string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM roomdate_app.push_subscriptions WHERE user_id = $1 AND endpoint = $2`, userID, endpoint)
	return err
}

// DeleteEndpoint cancella un'iscrizione che il servizio push dice scaduta.
func (s *Store) DeleteEndpoint(ctx context.Context, endpoint string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM roomdate_app.push_subscriptions WHERE endpoint = $1`, endpoint)
	return err
}

// ForUser restituisce le iscrizioni dell'utente con la sessione ancora valida (non scaduta e usata
// negli ultimi idle): un browser da cui non si entra più non riceve avvisi.
func (s *Store) ForUser(ctx context.Context, userID string, now time.Time, idle time.Duration) ([]webpush.Subscription, error) {
	rows, err := s.db.Query(ctx, `
        SELECT p.endpoint, p.p256dh, p.auth
        FROM roomdate_app.push_subscriptions p
        JOIN roomdate_app.sessions s ON s.id = p.session_id
        WHERE p.user_id = $1 AND s.expires_at > $2 AND s.last_used_at > $2 - $3::interval
        ORDER BY p.id`, userID, now, idle.String())
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[webpush.Subscription])
}

// FirstName è il nome di chi scrive, per il titolo della notifica.
func (s *Store) FirstName(ctx context.Context, userID string) (string, error) {
	var name string
	err := s.db.QueryRow(ctx, `SELECT COALESCE(first_name, '') FROM roomdate_app.users WHERE id = $1`, userID).Scan(&name)
	return name, err
}
