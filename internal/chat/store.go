// Package chat gestisce conversazioni e messaggi (cifrati end-to-end nel browser).
package chat

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"roomdate-backend/internal/db"
)

// Store esegue le query su conversazioni e messaggi.
//
// Una conversazione su un annuncio ha listing_id e tenant_id (chi la avvia): l'altro partecipante
// è il proprietario dell'annuncio. Una chat diretta ha listing_id NULL, tenant_id e user2_id.
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

func (s *Store) ListingExists(ctx context.Context, listingID int) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM roomdate_app.listings WHERE id = $1)`, listingID).Scan(&exists)
	return exists, err
}

func (s *Store) UserExists(ctx context.Context, userID string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM roomdate_app.users WHERE id = $1)`, userID).Scan(&exists)
	if db.IsInvalidInput(err) {
		return false, nil
	}
	return exists, err
}

func (s *Store) FindListingConversation(ctx context.Context, listingID int, tenantID string) (int, error) {
	var id int
	err := s.db.QueryRow(ctx, `
        SELECT id FROM roomdate_app.conversations
        WHERE listing_id = $1 AND tenant_id = $2
        ORDER BY id LIMIT 1`, listingID, tenantID).Scan(&id)
	return id, err
}

func (s *Store) CreateListingConversation(ctx context.Context, listingID int, tenantID string) (int, error) {
	var id int
	err := s.db.QueryRow(ctx, `
        INSERT INTO roomdate_app.conversations (listing_id, tenant_id) VALUES ($1, $2) RETURNING id`,
		listingID, tenantID).Scan(&id)
	return id, err
}

func (s *Store) FindDirectConversation(ctx context.Context, userA, userB string) (int, error) {
	var id int
	err := s.db.QueryRow(ctx, `
        SELECT id FROM roomdate_app.conversations
        WHERE listing_id IS NULL
          AND ((tenant_id = $1 AND user2_id = $2) OR (tenant_id = $2 AND user2_id = $1))
        ORDER BY id LIMIT 1`, userA, userB).Scan(&id)
	return id, err
}

func (s *Store) CreateDirectConversation(ctx context.Context, tenantID, targetID string) (int, error) {
	var id int
	err := s.db.QueryRow(ctx, `
        INSERT INTO roomdate_app.conversations (tenant_id, user2_id) VALUES ($1, $2) RETURNING id`,
		tenantID, targetID).Scan(&id)
	return id, err
}

// IsParticipant indica se l'utente fa parte della conversazione: chi l'ha avviata,
// il destinatario di una chat diretta o il proprietario dell'annuncio collegato.
func (s *Store) IsParticipant(ctx context.Context, conversationID int, userID string) (bool, error) {
	var ok bool
	err := s.db.QueryRow(ctx, `
        SELECT EXISTS (
            SELECT 1
            FROM roomdate_app.conversations c
            LEFT JOIN roomdate_app.listings l ON c.listing_id = l.id
            WHERE c.id = $1 AND (c.tenant_id = $2 OR c.user2_id = $2 OR l.user_id = $2)
        )`, conversationID, userID).Scan(&ok)
	return ok, err
}

// InsertMessage salva un messaggio: content è cifrato per il destinatario, senderContent per il mittente.
func (s *Store) InsertMessage(ctx context.Context, conversationID int, senderID, content, senderContent string) error {
	_, err := s.db.Exec(ctx, `
        INSERT INTO roomdate_app.messages (conversation_id, sender_id, content, sender_content)
        VALUES ($1, $2, $3, $4)`, conversationID, senderID, content, senderContent)
	return err
}

// ConversationRow è una conversazione vista da uno dei partecipanti.
type ConversationRow struct {
	ID             int
	ListingTitle   string
	ListingPrice   int
	OtherName      string
	OtherPublicKey string
}

// ConversationsFor restituisce le conversazioni dell'utente, con nome e chiave pubblica dell'altro partecipante.
func (s *Store) ConversationsFor(ctx context.Context, userID string) ([]ConversationRow, error) {
	rows, err := s.db.Query(ctx, `
        SELECT c.id,
               COALESCE(l.title, 'Chat Diretta'),
               COALESCE(l.price, 0),
               COALESCE(CASE
                   WHEN c.listing_id IS NOT NULL THEN
                       CASE WHEN c.tenant_id = $1 THEN owner.first_name ELSE tenant.first_name END
                   ELSE
                       CASE WHEN c.tenant_id = $1 THEN u2.first_name ELSE tenant.first_name END
               END, ''),
               COALESCE(CASE
                   WHEN c.listing_id IS NOT NULL THEN
                       CASE WHEN c.tenant_id = $1 THEN owner.public_key ELSE tenant.public_key END
                   ELSE
                       CASE WHEN c.tenant_id = $1 THEN u2.public_key ELSE tenant.public_key END
               END, '')
        FROM roomdate_app.conversations c
        LEFT JOIN roomdate_app.listings l ON c.listing_id = l.id
        LEFT JOIN roomdate_app.users owner ON l.user_id = owner.id
        LEFT JOIN roomdate_app.users tenant ON c.tenant_id = tenant.id
        LEFT JOIN roomdate_app.users u2 ON c.user2_id = u2.id
        WHERE c.tenant_id = $1 OR l.user_id = $1 OR c.user2_id = $1
        ORDER BY c.id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []ConversationRow
	for rows.Next() {
		var c ConversationRow
		if err := rows.Scan(&c.ID, &c.ListingTitle, &c.ListingPrice, &c.OtherName, &c.OtherPublicKey); err != nil {
			return nil, err
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

// MessageRow è un messaggio nella versione cifrata leggibile da chi lo richiede.
type MessageRow struct {
	ID        int
	SenderID  string
	Content   string
	CreatedAt time.Time
}

// MessagesFor restituisce i messaggi della conversazione: per i messaggi inviati dal lettore
// usa la copia cifrata per il mittente, per gli altri quella per il destinatario.
func (s *Store) MessagesFor(ctx context.Context, conversationID int, readerID string) ([]MessageRow, error) {
	rows, err := s.db.Query(ctx, `
        SELECT id, sender_id::text,
               CASE WHEN sender_id = $2 THEN COALESCE(sender_content, content, '') ELSE COALESCE(content, '') END,
               created_at
        FROM roomdate_app.messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC`, conversationID, readerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []MessageRow
	for rows.Next() {
		var m MessageRow
		if err := rows.Scan(&m.ID, &m.SenderID, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}
