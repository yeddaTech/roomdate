package chat

import (
	"context"
	"fmt"
	"strconv"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/db"
	"roomdate-backend/internal/logx"
	"roomdate-backend/internal/realtime"
	"roomdate-backend/internal/validate"
)

// Dimensione massima di un messaggio cifrato (Base64). RSA-OAEP a 2048 bit produce 344 caratteri:
// il margine serve alla cifratura ibrida prevista nel modulo M1.7.
const maxCiphertextLength = 8192

var (
	errInvalidConversation = apperr.BadRequest("invalid_conversation", "Conversazione non valida")
	errNotParticipant      = apperr.Forbidden("not_participant", "Accesso negato a questa conversazione")
)

type Service struct {
	store     *Store
	publisher realtime.Publisher
}

func NewService(store *Store, publisher realtime.Publisher) *Service {
	return &Service{store: store, publisher: publisher}
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
	exists, err := s.store.ListingExists(ctx, listingID)
	if err != nil {
		return 0, fmt.Errorf("verifica annuncio: %w", err)
	}
	if !exists {
		return 0, apperr.NotFound("listing_not_found", "Annuncio non trovato")
	}

	id, err := s.store.FindListingConversation(ctx, listingID, userID)
	if db.IsNoRows(err) {
		id, err = s.store.CreateListingConversation(ctx, listingID, userID)
	}
	if err != nil {
		return 0, apperr.Wrap(err, "chat_start_failed", "Errore interno database")
	}
	return id, nil
}

func (s *Service) startDirectChat(ctx context.Context, userID, targetID string) (int, error) {
	if !validate.MaxLen(targetID, 64) {
		return 0, apperr.NotFound("user_not_found", "Utente non trovato")
	}
	exists, err := s.store.UserExists(ctx, targetID)
	if err != nil {
		return 0, fmt.Errorf("verifica utente: %w", err)
	}
	if !exists {
		return 0, apperr.NotFound("user_not_found", "Utente non trovato")
	}

	id, err := s.store.FindDirectConversation(ctx, userID, targetID)
	if db.IsNoRows(err) {
		id, err = s.store.CreateDirectConversation(ctx, userID, targetID)
	}
	if err != nil {
		return 0, apperr.Wrap(err, "chat_start_failed", "Errore interno database")
	}
	return id, nil
}

type ListingSummary struct {
	Emoji string `json:"emoji"`
	Title string `json:"title"`
	Price int    `json:"price"`
}

type Message struct {
	ID   int    `json:"id"`
	Type string `json:"type"` // "sent" o "received", rispetto a chi legge
	Text string `json:"text"` // cifrato: il browser lo decifra
	Time string `json:"time"`
}

// Conversation è una conversazione con i suoi messaggi (formato JSON delle API legacy).
type Conversation struct {
	ID              int            `json:"id"`
	Name            string         `json:"name"`
	Emoji           string         `json:"emoji"`
	Color1          string         `json:"color1"`
	Color2          string         `json:"color2"`
	Listing         ListingSummary `json:"listing"`
	TargetPublicKey string         `json:"targetPublicKey"`
	Messages        []Message      `json:"messages"`
}

// Conversations restituisce tutte le conversazioni dell'utente con tutti i messaggi.
// Una query per conversazione e nessuna paginazione: vengono riprogettate nel modulo M1.7.
func (s *Service) Conversations(ctx context.Context, userID string) ([]Conversation, error) {
	rows, err := s.store.ConversationsFor(ctx, userID)
	if err != nil {
		return nil, apperr.Wrap(err, "chats_read_failed", "Errore caricamento chat")
	}

	colors := [][]string{{"#F5C29A", "#C4603A"}, {"#A8D8EA", "#4A90D9"}}
	conversations := make([]Conversation, 0, len(rows))
	for i, row := range rows {
		c := Conversation{
			ID:              row.ID,
			Name:            row.OtherName,
			Emoji:           "👤",
			Color1:          colors[i%len(colors)][0],
			Color2:          colors[i%len(colors)][1],
			Listing:         ListingSummary{Emoji: "🏠", Title: row.ListingTitle, Price: row.ListingPrice},
			TargetPublicKey: row.OtherPublicKey,
			Messages:        []Message{},
		}
		if c.Name == "" {
			c.Name = "Utente Sconosciuto"
		}
		if row.ListingPrice == 0 {
			c.Listing.Emoji = "💬"
		}

		messages, err := s.store.MessagesFor(ctx, row.ID, userID)
		if err != nil {
			return nil, apperr.Wrap(err, "chats_read_failed", "Errore caricamento chat")
		}
		for _, m := range messages {
			msgType := "received"
			if m.SenderID == userID {
				msgType = "sent"
			}
			c.Messages = append(c.Messages, Message{ID: m.ID, Type: msgType, Text: m.Content, Time: m.CreatedAt.Format("15:04")})
		}
		conversations = append(conversations, c)
	}
	return conversations, nil
}

// SendMessageInput contiene il messaggio cifrato due volte: per il destinatario e per il mittente.
type SendMessageInput struct {
	ConversationID int    `json:"conversationId"`
	Text           string `json:"text"`
	SenderText     string `json:"senderText"`
}

func (s *Service) SendMessage(ctx context.Context, userID string, in SendMessageInput) error {
	if in.ConversationID <= 0 {
		return errInvalidConversation
	}
	var v validate.Validator
	v.Check(validate.NotBlank(in.Text) && validate.MaxLen(in.Text, maxCiphertextLength), "text", "Messaggio non valido")
	v.Check(validate.NotBlank(in.SenderText) && validate.MaxLen(in.SenderText, maxCiphertextLength), "senderText", "Messaggio non valido")
	if err := v.Err(); err != nil {
		return err
	}

	if err := s.requireParticipant(ctx, in.ConversationID, userID); err != nil {
		return err
	}
	if err := s.store.InsertMessage(ctx, in.ConversationID, userID, in.Text, in.SenderText); err != nil {
		return apperr.Wrap(err, "message_send_failed", "Impossibile inviare il messaggio")
	}

	// Il messaggio è salvato: se la notifica in tempo reale fallisce, i client lo vedranno al prossimo aggiornamento
	if err := s.publisher.Publish(ctx, realtime.EventNewMessage, map[string]any{"conversationId": in.ConversationID}); err != nil {
		logx.From(ctx).Warn("notifica nuovo messaggio non inviata", "err", err)
	}
	return nil
}

// Typing segnala agli altri client che l'utente sta scrivendo. Il mittente è sempre quello della sessione.
func (s *Service) Typing(ctx context.Context, userID, rawConversationID string) error {
	conversationID, ok := validate.PositiveID(rawConversationID)
	if !ok {
		return errInvalidConversation
	}
	if err := s.requireParticipant(ctx, conversationID, userID); err != nil {
		return err
	}

	err := s.publisher.Publish(ctx, realtime.EventTyping, map[string]string{
		"conversationId": strconv.Itoa(conversationID),
		"senderId":       userID,
	})
	if err != nil {
		return apperr.Wrap(err, "realtime_failed", "Errore di trasmissione in tempo reale")
	}
	return nil
}

func (s *Service) requireParticipant(ctx context.Context, conversationID int, userID string) error {
	ok, err := s.store.IsParticipant(ctx, conversationID, userID)
	if err != nil {
		return fmt.Errorf("verifica partecipante: %w", err)
	}
	if !ok {
		return errNotParticipant
	}
	return nil
}
