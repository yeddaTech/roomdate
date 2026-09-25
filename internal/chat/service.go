package chat

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/db"
	"roomdate-backend/internal/logx"
	"roomdate-backend/internal/moderation"
	"roomdate-backend/internal/page"
	"roomdate-backend/internal/realtime"
	"roomdate-backend/internal/validate"
)

const (
	// Con la cifratura ibrida il limite non dipende più da RSA (anomalia F8): il testo cifrato
	// cresce poco più del messaggio scritto, e questo margine copre messaggi molto lunghi.
	maxBodyLength = 24000
	maxKeyLength  = 1024
	// Dimensione delle pagine di conversazioni e messaggi.
	conversationsLimit = 30
	messagesLimit      = 40
	maxLimit           = 100
)

var (
	errSelfChat            = apperr.BadRequest("self_chat", "Non puoi avviare una conversazione con te stesso")
	errInvalidConversation = apperr.BadRequest("invalid_conversation", "Conversazione non valida")
	errNotParticipant      = apperr.Forbidden("not_participant", "Accesso negato a questa conversazione")
	errKeysMismatch        = apperr.BadRequest("keys_mismatch", "Chiavi del messaggio non valide: ricarica la pagina e riprova")
	// Blocchi e sospensioni (modulo M3.3): lo stesso messaggio chiunque dei due abbia bloccato
	errBlocked            = apperr.Forbidden("user_blocked", "Non è possibile contattare questo utente")
	errConversationClosed = apperr.Forbidden("conversation_blocked", "Non puoi più inviare messaggi in questa conversazione")
	errUserUnavailable    = apperr.Forbidden("user_unavailable", "Questo utente non è più disponibile")
)

type Service struct {
	store      *Store
	publisher  realtime.Publisher
	authorizer realtime.Authorizer
	// blocks dice se due utenti si sono bloccati: non possono più scriversi
	blocks *moderation.Store
}

func NewService(store *Store, publisher realtime.Publisher, authorizer realtime.Authorizer, blocks *moderation.Store) *Service {
	return &Service{store: store, publisher: publisher, authorizer: authorizer, blocks: blocks}
}

// StartChatInput identifica l'annuncio (chat su annuncio) o l'utente (chat diretta).
type StartChatInput struct {
	ListingID int    `json:"listingId,omitempty"`
	TargetID  string `json:"targetId,omitempty"`
}

// StartChat restituisce la conversazione esistente o ne crea una nuova.
func (s *Service) StartChat(ctx context.Context, userID string, in StartChatInput) (int, error) {
	switch {
	case in.ListingID != 0:
		return s.startListingChat(ctx, userID, in.ListingID)
	case in.TargetID != "":
		return s.startDirectChat(ctx, userID, in.TargetID)
	default:
		return 0, apperr.BadRequest("missing_target", "Manca ListingID o TargetID")
	}
}

func (s *Service) startListingChat(ctx context.Context, userID string, listingID int) (int, error) {
	if listingID < 0 {
		return 0, apperr.BadRequest("invalid_listing_id", "ID annuncio non valido")
	}
	ownerID, contactable, err := s.store.ListingForChat(ctx, listingID)
	// Un annuncio senza proprietario (user_id NULL) non si può contattare
	if db.IsNoRows(err) || (err == nil && (!contactable || ownerID == "")) {
		return 0, apperr.NotFound("listing_not_found", "Annuncio non trovato o non più disponibile")
	}
	if err != nil {
		return 0, fmt.Errorf("verifica annuncio: %w", err)
	}
	if ownerID == userID {
		return 0, errSelfChat
	}
	if err := s.requireNotBlocked(ctx, userID, ownerID, errBlocked); err != nil {
		return 0, err
	}

	key := fmt.Sprintf("listing:%d:%s", listingID, userID)
	id, err := s.store.EnsureConversation(ctx, key, &listingID, userID, ownerID)
	if err != nil {
		return 0, apperr.Wrap(err, "chat_start_failed", "Errore interno database")
	}
	return id, nil
}

func (s *Service) startDirectChat(ctx context.Context, userID, targetID string) (int, error) {
	if !validate.MaxLen(targetID, 64) {
		return 0, apperr.NotFound("user_not_found", "Utente non trovato")
	}
	target, err := s.store.ChatTarget(ctx, targetID)
	notFound := apperr.NotFound("user_not_found", "Utente non trovato")
	if db.IsNoRows(err) || (err == nil && target.Suspended) {
		return 0, notFound
	}
	if err != nil {
		return 0, fmt.Errorf("verifica utente: %w", err)
	}
	// ID nella forma salvata nel database (UUID in minuscolo anche se il client lo ha inviato in maiuscolo)
	targetID = target.ID
	if targetID == userID {
		return 0, errSelfChat
	}
	if err := s.requireNotBlocked(ctx, userID, targetID, errBlocked); err != nil {
		return 0, err
	}

	// La chiave non dipende da chi apre la conversazione: la coppia ne ha sempre una sola
	first, second := userID, targetID
	if second < first {
		first, second = second, first
	}
	key := "direct:" + first + ":" + second
	// Un profilo privato non si può contattare da zero, ma una conversazione già avviata si riapre
	if !target.IsPublic {
		id, err := s.store.ConversationByKey(ctx, key)
		if db.IsNoRows(err) {
			return 0, notFound
		}
		if err != nil {
			return 0, fmt.Errorf("verifica conversazione: %w", err)
		}
		return id, nil
	}
	id, err := s.store.EnsureConversation(ctx, key, nil, userID, targetID)
	if err != nil {
		return 0, apperr.Wrap(err, "chat_start_failed", "Errore interno database")
	}
	return id, nil
}

// Message è un messaggio come lo riceve chi lo legge: il testo resta cifrato, insieme
// agli elementi che servono al browser per decifrarlo.
type Message struct {
	ID       int    `json:"id"`
	SenderID string `json:"senderId"`
	// Format 1 = una copia cifrata per destinatario (messaggi vecchi), 2 = cifratura ibrida.
	Format int    `json:"format"`
	Body   string `json:"body"`
	// IV e Key sono vuoti nel formato 1.
	IV  string `json:"iv"`
	Key string `json:"key"`
	// CreatedAt è in UTC: il browser lo mostra nell'ora locale (anomalia F11).
	CreatedAt time.Time `json:"createdAt"`
}

func message(r MessageRow) Message {
	return Message{ID: r.ID, SenderID: r.SenderID, Format: r.Format, Body: r.Body, IV: r.IV, Key: r.WrappedKey, CreatedAt: r.CreatedAt.UTC()}
}

// Listing è l'annuncio da cui è nata la conversazione, se esiste ancora.
type Listing struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
	Price int    `json:"price"`
}

// Participant è l'altro partecipante; è null se ha eliminato l'account.
type OtherParticipant struct {
	ID        string `json:"id"`
	FirstName string `json:"firstName"`
	PublicKey string `json:"publicKey"`
	// Unavailable: l'account è stato sospeso, non gli si può più scrivere.
	Unavailable bool `json:"unavailable"`
}

// Stato di blocco di una conversazione, visto da chi la legge.
const (
	BlockedByMe    = "by_me"
	BlockedByOther = "by_other"
)

// Conversation è una conversazione nell'elenco.
type Conversation struct {
	ID          int               `json:"id"`
	Listing     *Listing          `json:"listing"`
	Other       *OtherParticipant `json:"other"`
	LastMessage *Message          `json:"lastMessage"`
	// Blocked è "by_me", "by_other" o null: con un blocco nessuno dei due può scrivere.
	Blocked     *string   `json:"blocked"`
	UnreadCount int       `json:"unreadCount"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// ConversationsPage è una pagina dell'elenco delle conversazioni.
type ConversationsPage struct {
	Items      []Conversation `json:"items"`
	NextCursor *string        `json:"nextCursor"`
}

// MessagesPage è una pagina di messaggi, dal più recente al più vecchio.
type MessagesPage struct {
	Items      []Message `json:"items"`
	NextCursor *string   `json:"nextCursor"`
}

// Conversations restituisce una pagina delle conversazioni dell'utente, con l'ultimo messaggio
// e quanti messaggi non ha ancora letto.
func (s *Service) Conversations(ctx context.Context, userID, cursor, rawLimit string) (ConversationsPage, error) {
	q := ConversationsQuery{UserID: userID, Limit: conversationsLimit}

	var v validate.Validator
	if rawLimit != "" {
		limit, err := strconv.Atoi(rawLimit)
		v.Check(err == nil && validate.Between(limit, 1, maxLimit), "limit",
			fmt.Sprintf("Il numero di conversazioni per pagina deve essere tra 1 e %d", maxLimit))
		q.Limit = limit
	}
	if cursor != "" {
		after, ok := decodeConversationsCursor(cursor)
		v.Check(ok, "cursor", "Pagina non valida: ricarica le conversazioni")
		q.After = &after
	}
	if err := v.Err(); err != nil {
		return ConversationsPage{}, err
	}

	// Una conversazione in più dice se esiste la pagina successiva
	limit := q.Limit
	q.Limit++
	rows, err := s.store.Conversations(ctx, q)
	if err != nil {
		return ConversationsPage{}, apperr.Wrap(err, "chats_read_failed", "Errore caricamento chat")
	}

	result := ConversationsPage{Items: []Conversation{}}
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		cursor := page.Encode(last.LastActivity.UTC().Format(time.RFC3339Nano), strconv.Itoa(last.ID))
		result.NextCursor = &cursor
	}
	for _, r := range rows {
		c := Conversation{ID: r.ID, UnreadCount: r.UnreadCount, UpdatedAt: r.LastActivity.UTC()}
		if r.ListingID != nil {
			c.Listing = &Listing{ID: *r.ListingID, Title: r.ListingTitle, Price: r.ListingPrice}
		}
		if r.OtherID != "" {
			c.Other = &OtherParticipant{ID: r.OtherID, FirstName: r.OtherFirstName, PublicKey: r.OtherPublicKey, Unavailable: r.OtherSuspended}
		}
		// Se si sono bloccati a vicenda conta il blocco di chi guarda: è quello che può togliere
		switch {
		case r.BlockedByMe:
			state := BlockedByMe
			c.Blocked = &state
		case r.BlockedByOther:
			state := BlockedByOther
			c.Blocked = &state
		}
		if r.LastMessage != nil {
			last := message(*r.LastMessage)
			c.LastMessage = &last
		}
		result.Items = append(result.Items, c)
	}
	return result, nil
}

// Messages restituisce una pagina di messaggi, dal più recente: il cursore serve a caricare i più vecchi.
func (s *Service) Messages(ctx context.Context, userID, rawConversationID, cursor, rawLimit string) (MessagesPage, error) {
	conversationID, err := s.requireParticipantByID(ctx, userID, rawConversationID)
	if err != nil {
		return MessagesPage{}, err
	}

	q := MessagesQuery{ConversationID: conversationID, ReaderID: userID, Limit: messagesLimit}
	var v validate.Validator
	if rawLimit != "" {
		limit, err := strconv.Atoi(rawLimit)
		v.Check(err == nil && validate.Between(limit, 1, maxLimit), "limit",
			fmt.Sprintf("Il numero di messaggi per pagina deve essere tra 1 e %d", maxLimit))
		q.Limit = limit
	}
	if cursor != "" {
		after, ok := decodeMessagesCursor(cursor)
		v.Check(ok, "cursor", "Pagina non valida: ricarica la conversazione")
		q.After = &after
	}
	if err := v.Err(); err != nil {
		return MessagesPage{}, err
	}

	limit := q.Limit
	q.Limit++
	rows, err := s.store.Messages(ctx, q)
	if err != nil {
		return MessagesPage{}, apperr.Wrap(err, "chats_read_failed", "Errore caricamento messaggi")
	}

	result := MessagesPage{Items: []Message{}}
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		cursor := page.Encode(last.CreatedAt.UTC().Format(time.RFC3339Nano), strconv.Itoa(last.ID))
		result.NextCursor = &cursor
	}
	for _, r := range rows {
		result.Items = append(result.Items, message(r))
	}
	return result, nil
}

// SendMessageInput è un messaggio cifrato: il testo una volta sola, e la chiave del messaggio
// cifrata per ogni partecipante.
type SendMessageInput struct {
	Body string `json:"body"`
	IV   string `json:"iv"`
	Keys []struct {
		UserID string `json:"userId"`
		Key    string `json:"key"`
	} `json:"keys"`
}

// SendMessage salva il messaggio e avvisa i partecipanti.
func (s *Service) SendMessage(ctx context.Context, userID, rawConversationID string, in SendMessageInput) (Message, error) {
	conversationID, err := s.requireParticipantByID(ctx, userID, rawConversationID)
	if err != nil {
		return Message{}, err
	}

	var v validate.Validator
	v.Check(validate.NotBlank(in.Body) && validate.Base64(in.Body, maxBodyLength), "body", "Messaggio non valido")
	v.Check(validate.Base64(in.IV, 64) && in.IV != "", "iv", "Messaggio non valido")
	if err := v.Err(); err != nil {
		return Message{}, err
	}

	participants, err := s.store.Participants(ctx, conversationID)
	if err != nil {
		return Message{}, fmt.Errorf("lettura partecipanti: %w", err)
	}
	if err := s.requireOpen(ctx, userID, participants); err != nil {
		return Message{}, err
	}

	// Serve una chiave per ogni partecipante che ha una chiave pubblica, e nessuna in più
	keys := make(map[string]string, len(in.Keys))
	for _, k := range in.Keys {
		if !validate.Base64(k.Key, maxKeyLength) || k.Key == "" {
			return Message{}, errKeysMismatch
		}
		keys[k.UserID] = k.Key
	}
	expected := 0
	for _, p := range participants {
		if p.PublicKey == "" {
			continue
		}
		expected++
		if keys[p.UserID] == "" {
			return Message{}, errKeysMismatch
		}
	}
	if len(keys) != expected {
		return Message{}, errKeysMismatch
	}

	saved, err := s.store.InsertMessage(ctx, NewMessage{
		ConversationID: conversationID, SenderID: userID, Body: in.Body, IV: in.IV, Keys: keys,
	})
	if err != nil {
		return Message{}, apperr.Wrap(err, "message_send_failed", "Impossibile inviare il messaggio")
	}

	// Il messaggio è salvato: se la notifica in tempo reale fallisce, i client lo vedranno al prossimo aggiornamento
	for _, p := range participants {
		if p.UserID == userID {
			continue
		}
		err := s.publisher.Publish(ctx, realtime.UserChannel(p.UserID), realtime.EventNewMessage,
			map[string]int{"conversationId": conversationID, "messageId": saved.ID})
		if err != nil {
			logx.From(ctx).Warn("notifica nuovo messaggio non inviata", "err", err)
		}
	}
	return message(saved), nil
}

// UnreadCount restituisce quante conversazioni hanno messaggi non letti.
func (s *Service) UnreadCount(ctx context.Context, userID string) (int, error) {
	n, err := s.store.UnreadConversations(ctx, userID)
	if err != nil {
		return 0, apperr.Wrap(err, "unread_read_failed", "Impossibile leggere i messaggi non letti")
	}
	return n, nil
}

// MarkRead segna come letti i messaggi della conversazione fino a ora.
func (s *Service) MarkRead(ctx context.Context, userID, rawConversationID string) error {
	conversationID, err := s.requireParticipantByID(ctx, userID, rawConversationID)
	if err != nil {
		return err
	}
	if err := s.store.MarkRead(ctx, conversationID, userID); err != nil {
		return apperr.Wrap(err, "mark_read_failed", "Impossibile aggiornare i messaggi letti")
	}
	return nil
}

// requireNotBlocked restituisce blockedErr se tra i due utenti c'è un blocco, in qualunque direzione.
func (s *Service) requireNotBlocked(ctx context.Context, userID, otherID string, blockedErr error) error {
	relation, err := s.blocks.Relation(ctx, userID, otherID)
	if err != nil {
		return fmt.Errorf("verifica blocchi: %w", err)
	}
	if relation.Blocked() {
		return blockedErr
	}
	return nil
}

// requireOpen verifica che nella conversazione si possa ancora scrivere: nessun blocco tra
// l'utente e gli altri partecipanti, e nessuno di loro sospeso.
func (s *Service) requireOpen(ctx context.Context, userID string, participants []Participant) error {
	for _, p := range participants {
		if p.UserID == userID {
			continue
		}
		if p.Suspended {
			return errUserUnavailable
		}
		if err := s.requireNotBlocked(ctx, userID, p.UserID, errConversationClosed); err != nil {
			return err
		}
	}
	return nil
}

// requireParticipantByID converte l'ID nell'URL e verifica che l'utente faccia parte della conversazione.
func (s *Service) requireParticipantByID(ctx context.Context, userID, rawConversationID string) (int, error) {
	conversationID, ok := validate.PositiveID(rawConversationID)
	if !ok {
		return 0, errInvalidConversation
	}
	participant, err := s.store.IsParticipant(ctx, conversationID, userID)
	if err != nil {
		return 0, fmt.Errorf("verifica partecipante: %w", err)
	}
	if !participant {
		return 0, errNotParticipant
	}
	return conversationID, nil
}

func decodeConversationsCursor(cursor string) (ConversationsCursor, bool) {
	activity, id, ok := decodeTimeCursor(cursor)
	return ConversationsCursor{LastActivity: activity, ID: id}, ok
}

func decodeMessagesCursor(cursor string) (MessagesCursor, bool) {
	created, id, ok := decodeTimeCursor(cursor)
	return MessagesCursor{CreatedAt: created, ID: id}, ok
}

// decodeTimeCursor legge un cursore "data|id".
func decodeTimeCursor(cursor string) (time.Time, int, bool) {
	fields, ok := page.Decode(cursor, 2)
	if !ok {
		return time.Time{}, 0, false
	}
	moment, err := time.Parse(time.RFC3339Nano, fields[0])
	if err != nil {
		return time.Time{}, 0, false
	}
	id, ok := validate.PositiveID(fields[1])
	if !ok {
		return time.Time{}, 0, false
	}
	return moment, id, true
}
