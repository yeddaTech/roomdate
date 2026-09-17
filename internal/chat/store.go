// Package chat gestisce conversazioni e messaggi (cifrati end-to-end nel browser).
package chat

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"roomdate-backend/internal/db"
)

// Formati dei messaggi salvati.
const (
	// FormatPerRecipient: una copia cifrata con RSA per ogni partecipante, nelle colonne
	// content e sender_content. Solo messaggi vecchi: RSA-OAEP si ferma a 190 byte (anomalia F8).
	FormatPerRecipient = 1
	// FormatHybrid: un testo cifrato con AES-GCM (body, iv) e la chiave del messaggio
	// cifrata con RSA per ogni partecipante, in message_keys.
	FormatHybrid = 2
)

// Store esegue le query su conversazioni, partecipanti e messaggi.
//
// I partecipanti stanno in conversation_participants; le colonne tenant_id e user2_id restano
// riempite per compatibilità. Una conversazione su un annuncio ha anche listing_id: se l'annuncio
// viene eliminato, listing_id diventa NULL e la conversazione resta ai due partecipanti.
// Chi elimina l'account sparisce dai partecipanti, e per l'altro diventa "Utente eliminato".
type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// ListingForChat restituisce il proprietario dell'annuncio e se l'annuncio è attivo.
func (s *Store) ListingForChat(ctx context.Context, listingID int) (ownerID string, active bool, err error) {
	err = s.db.QueryRow(ctx, `SELECT COALESCE(user_id::text, ''), is_active FROM roomdate_app.listings WHERE id = $1`, listingID).Scan(&ownerID, &active)
	return ownerID, active, err
}

// UserID restituisce l'ID dell'utente nella forma salvata nel database; pgx.ErrNoRows se non esiste.
func (s *Store) UserID(ctx context.Context, userID string) (string, error) {
	var id string
	err := s.db.QueryRow(ctx, `SELECT id::text FROM roomdate_app.users WHERE id = $1`, userID).Scan(&id)
	if db.IsInvalidInput(err) {
		return "", pgx.ErrNoRows
	}
	return id, err
}

// EnsureConversation restituisce la conversazione con questa chiave, creandola se non esiste.
// La chiave unica evita che due click ravvicinati creino due conversazioni uguali (anomalia F13).
func (s *Store) EnsureConversation(ctx context.Context, dedupKey string, listingID *int, creatorID, otherID string) (int, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var id int
	err = tx.QueryRow(ctx, `
        INSERT INTO roomdate_app.conversations (listing_id, tenant_id, user2_id, dedup_key)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (dedup_key) DO UPDATE SET dedup_key = EXCLUDED.dedup_key
        RETURNING id`, listingID, creatorID, otherID, dedupKey).Scan(&id)
	if err != nil {
		return 0, err
	}

	_, err = tx.Exec(ctx, `
        INSERT INTO roomdate_app.conversation_participants (conversation_id, user_id)
        VALUES ($1, $2), ($1, $3)
        ON CONFLICT DO NOTHING`, id, creatorID, otherID)
	if err != nil {
		return 0, err
	}
	return id, tx.Commit(ctx)
}

// Participant è un partecipante alla conversazione, con la chiave pubblica per cifrargli i messaggi.
type Participant struct {
	UserID    string
	PublicKey string
}

// Participants restituisce i partecipanti ancora esistenti, in ordine di ID.
func (s *Store) Participants(ctx context.Context, conversationID int) ([]Participant, error) {
	rows, err := s.db.Query(ctx, `
        SELECT p.user_id::text, COALESCE(u.public_key, '')
        FROM roomdate_app.conversation_participants p
        JOIN roomdate_app.users u ON u.id = p.user_id
        WHERE p.conversation_id = $1
        ORDER BY p.user_id`, conversationID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Participant, error) {
		var p Participant
		err := row.Scan(&p.UserID, &p.PublicKey)
		return p, err
	})
}

// IsParticipant indica se l'utente fa parte della conversazione.
func (s *Store) IsParticipant(ctx context.Context, conversationID int, userID string) (bool, error) {
	var ok bool
	err := s.db.QueryRow(ctx, `
        SELECT EXISTS (
            SELECT 1 FROM roomdate_app.conversation_participants
            WHERE conversation_id = $1 AND user_id = $2
        )`, conversationID, userID).Scan(&ok)
	return ok, err
}

// MessageRow è un messaggio nella versione leggibile da chi lo richiede: WrappedKey è la chiave
// del messaggio cifrata per lui (solo nel formato ibrido).
type MessageRow struct {
	ID         int
	SenderID   string
	Format     int
	Body       string
	IV         string
	WrappedKey string
	CreatedAt  time.Time
}

// messageColumns sceglie la copia leggibile da $2: nel formato ibrido il testo è unico,
// in quello vecchio c'è una copia per il mittente e una per il destinatario.
// Le conversazioni senza messaggi hanno tutte le colonne a NULL: il formato 0 dice "nessun messaggio".
const messageColumns = `m.id, COALESCE(m.sender_id::text, ''), COALESCE(m.format, 0),
    COALESCE(CASE WHEN m.format = 2 THEN m.body
                  WHEN m.sender_id = $2 THEN COALESCE(m.sender_content, m.content)
                  ELSE m.content END, ''),
    COALESCE(m.iv, ''),
    COALESCE((SELECT k.wrapped_key FROM roomdate_app.message_keys k
              WHERE k.message_id = m.id AND k.user_id = $2), ''),
    COALESCE(m.created_at, 'epoch')`

func scanMessage(row pgx.CollectableRow) (MessageRow, error) {
	var m MessageRow
	err := row.Scan(&m.ID, &m.SenderID, &m.Format, &m.Body, &m.IV, &m.WrappedKey, &m.CreatedAt)
	return m, err
}

// ConversationRow è una conversazione vista da un partecipante.
type ConversationRow struct {
	ID           int
	ListingID    *int
	ListingTitle string
	ListingPrice int
	// OtherID è vuoto se l'altro partecipante ha eliminato l'account.
	OtherID, OtherFirstName, OtherPublicKey string
	UnreadCount                             int
	// LastActivity è la data dell'ultimo messaggio, o quella della conversazione se non ce ne sono.
	LastActivity time.Time
	// LastMessage è nil se la conversazione non ha ancora messaggi.
	LastMessage *MessageRow
}

// ConversationsQuery pagina l'elenco delle conversazioni di un utente.
type ConversationsQuery struct {
	UserID string
	After  *ConversationsCursor
	Limit  int
}

// ConversationsCursor è la posizione dell'ultima conversazione della pagina precedente.
type ConversationsCursor struct {
	LastActivity time.Time
	ID           int
}

// Conversations restituisce una pagina delle conversazioni dell'utente, dalla più recente.
// Una sola query per pagina: ultimo messaggio e non letti arrivano con LATERAL (anomalia F12).
func (s *Store) Conversations(ctx context.Context, q ConversationsQuery) ([]ConversationRow, error) {
	var afterTime *time.Time
	var afterID int
	if q.After != nil {
		afterTime, afterID = &q.After.LastActivity, q.After.ID
	}
	rows, err := s.db.Query(ctx, `
        SELECT c.id, l.id, COALESCE(l.title, ''), COALESCE(l.price, 0),
               COALESCE(other.user_id::text, ''), COALESCE(other.first_name, ''), COALESCE(other.public_key, ''),
               unread.count, COALESCE(m.created_at, c.created_at, 'epoch'),
               `+messageColumns+`
        FROM roomdate_app.conversation_participants me
        JOIN roomdate_app.conversations c ON c.id = me.conversation_id
        LEFT JOIN roomdate_app.listings l ON l.id = c.listing_id
        LEFT JOIN LATERAL (
            SELECT p.user_id, u.first_name, u.public_key
            FROM roomdate_app.conversation_participants p
            JOIN roomdate_app.users u ON u.id = p.user_id
            WHERE p.conversation_id = c.id AND p.user_id <> me.user_id
            ORDER BY p.user_id
            LIMIT 1
        ) other ON true
        LEFT JOIN LATERAL (
            SELECT last.* FROM roomdate_app.messages last
            WHERE last.conversation_id = c.id
            ORDER BY COALESCE(last.created_at, 'epoch') DESC, last.id DESC
            LIMIT 1
        ) m ON true
        LEFT JOIN LATERAL (
            SELECT count(*) AS count FROM roomdate_app.messages unread
            WHERE unread.conversation_id = c.id
              AND (unread.sender_id IS NULL OR unread.sender_id <> me.user_id)
              AND (me.last_read_at IS NULL OR COALESCE(unread.created_at, 'epoch') > me.last_read_at)
        ) unread ON true
        WHERE me.user_id = $1
          AND ($3::timestamptz IS NULL
               OR (COALESCE(m.created_at, c.created_at, 'epoch'), c.id) < ($3::timestamptz, $4))
        ORDER BY COALESCE(m.created_at, c.created_at, 'epoch') DESC, c.id DESC
        LIMIT $5`,
		q.UserID, q.UserID, afterTime, afterID, q.Limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (ConversationRow, error) {
		var c ConversationRow
		var messageID *int
		var m MessageRow
		err := row.Scan(&c.ID, &c.ListingID, &c.ListingTitle, &c.ListingPrice,
			&c.OtherID, &c.OtherFirstName, &c.OtherPublicKey, &c.UnreadCount, &c.LastActivity,
			&messageID, &m.SenderID, &m.Format, &m.Body, &m.IV, &m.WrappedKey, &m.CreatedAt)
		if err == nil && messageID != nil {
			m.ID = *messageID
			c.LastMessage = &m
		}
		return c, err
	})
}

// MessagesQuery pagina i messaggi di una conversazione, dal più recente.
type MessagesQuery struct {
	ConversationID int
	ReaderID       string
	After          *MessagesCursor
	Limit          int
}

// MessagesCursor è la posizione del messaggio più vecchio già ricevuto.
type MessagesCursor struct {
	CreatedAt time.Time
	ID        int
}

func (s *Store) Messages(ctx context.Context, q MessagesQuery) ([]MessageRow, error) {
	var afterTime *time.Time
	var afterID int
	if q.After != nil {
		afterTime, afterID = &q.After.CreatedAt, q.After.ID
	}
	rows, err := s.db.Query(ctx, `
        SELECT `+messageColumns+`
        FROM roomdate_app.messages m
        WHERE m.conversation_id = $1
          AND ($3::timestamptz IS NULL OR (COALESCE(m.created_at, 'epoch'), m.id) < ($3::timestamptz, $4))
        ORDER BY COALESCE(m.created_at, 'epoch') DESC, m.id DESC
        LIMIT $5`,
		q.ConversationID, q.ReaderID, afterTime, afterID, q.Limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, scanMessage)
}

// NewMessage è un messaggio da salvare: un testo cifrato e la chiave per ogni partecipante.
type NewMessage struct {
	ConversationID int
	SenderID       string
	Body           string
	IV             string
	// Keys associa a ogni partecipante la chiave del messaggio cifrata per lui.
	Keys map[string]string
}

// InsertMessage salva il messaggio e le chiavi dei partecipanti, e lo restituisce come lo legge il mittente.
func (s *Store) InsertMessage(ctx context.Context, m NewMessage) (MessageRow, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return MessageRow{}, err
	}
	defer tx.Rollback(ctx)

	saved := MessageRow{SenderID: m.SenderID, Format: FormatHybrid, Body: m.Body, IV: m.IV, WrappedKey: m.Keys[m.SenderID]}
	err = tx.QueryRow(ctx, `
        INSERT INTO roomdate_app.messages (conversation_id, sender_id, format, body, iv, content)
        VALUES ($1, $2, $3, $4, $5, '')
        RETURNING id, created_at`, m.ConversationID, m.SenderID, FormatHybrid, m.Body, m.IV,
	).Scan(&saved.ID, &saved.CreatedAt)
	if err != nil {
		return MessageRow{}, err
	}

	for userID, key := range m.Keys {
		_, err = tx.Exec(ctx, `
            INSERT INTO roomdate_app.message_keys (message_id, user_id, wrapped_key)
            VALUES ($1, $2, $3)`, saved.ID, userID, key)
		if err != nil {
			return MessageRow{}, err
		}
	}
	return saved, tx.Commit(ctx)
}

// MarkRead segna come letti i messaggi fino a ora.
func (s *Store) MarkRead(ctx context.Context, conversationID int, userID string) error {
	_, err := s.db.Exec(ctx, `
        UPDATE roomdate_app.conversation_participants
        SET last_read_at = NOW()
        WHERE conversation_id = $1 AND user_id = $2`, conversationID, userID)
	return err
}
