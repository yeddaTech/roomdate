package push

import (
	"context"
	"crypto/ecdh"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/logx"
	"roomdate-backend/internal/validate"
	"roomdate-backend/internal/webpush"
)

var (
	errUnavailable = apperr.New(http.StatusServiceUnavailable, "push_unavailable", "Le notifiche a sito chiuso non sono attive su questo server")
	errInvalid     = apperr.BadRequest("invalid_subscription", "Iscrizione alle notifiche non valida")
)

// Quanto aspettare i servizi push mentre si invia un messaggio, in tutto.
const sendTimeout = 4 * time.Second

// Una notifica di un messaggio vale per 12 ore: dopo, chi riaccende il telefono lo vede in chat.
const messageTTL = 12 * time.Hour

// Sender invia una notifica a un'iscrizione (webpush.Sender, o un finto nei test).
type Sender interface {
	PublicKey() string
	Endpoints() webpush.Endpoints
	Send(ctx context.Context, sub webpush.Subscription, msg webpush.Message) error
}

// Service registra le iscrizioni e avvisa dei messaggi.
type Service struct {
	store  *Store
	sender Sender // nil: notifiche push spente (nessuna chiave VAPID)
	now    func() time.Time
}

func NewService(store *Store, sender Sender) *Service {
	return &Service{store: store, sender: sender, now: time.Now}
}

// PublicKey è la chiave VAPID pubblica per l'iscrizione nel browser.
func (s *Service) PublicKey() (string, error) {
	if s.sender == nil {
		return "", errUnavailable
	}
	return s.sender.PublicKey(), nil
}

// SubscriptionInput è PushSubscription.toJSON() del browser.
type SubscriptionInput struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

// Subscribe registra l'iscrizione del browser della sessione.
func (s *Service) Subscribe(ctx context.Context, session auth.Session, in SubscriptionInput) error {
	if s.sender == nil {
		return errUnavailable
	}
	var v validate.Validator
	v.Check(len(in.Endpoint) <= 1000 && s.sender.Endpoints().Allowed(in.Endpoint), "endpoint", "Indirizzo del servizio di notifiche non valido")
	v.Check(validKey(in.Keys.P256dh), "keys.p256dh", "Chiave non valida")
	v.Check(validSecret(in.Keys.Auth), "keys.auth", "Chiave non valida")
	if err := v.Err(); err != nil {
		return err
	}
	sub := webpush.Subscription{Endpoint: in.Endpoint, P256dh: strings.TrimRight(in.Keys.P256dh, "="), Auth: strings.TrimRight(in.Keys.Auth, "=")}
	if err := s.store.Save(ctx, session.UserID, session.ID, sub); err != nil {
		return apperr.Wrap(err, "push_subscribe_failed", "Impossibile attivare le notifiche")
	}
	return nil
}

// Unsubscribe cancella l'iscrizione di un browser dell'utente.
func (s *Service) Unsubscribe(ctx context.Context, userID, endpoint string) error {
	if endpoint == "" || len(endpoint) > 1000 {
		return errInvalid
	}
	if err := s.store.Delete(ctx, userID, endpoint); err != nil {
		return apperr.Wrap(err, "push_unsubscribe_failed", "Impossibile disattivare le notifiche")
	}
	return nil
}

// La chiave pubblica del browser: un punto P-256 non compresso in Base64 URL.
func validKey(encoded string) bool {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(encoded, "="))
	if err != nil {
		return false
	}
	_, err = ecdh.P256().NewPublicKey(raw)
	return err == nil
}

// Il segreto condiviso: 16 byte in Base64 URL.
func validSecret(encoded string) bool {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(encoded, "="))
	return err == nil && len(raw) == 16
}

// Il contenuto della notifica, letto dal service worker (public/sw.js).
type messagePayload struct {
	Type           string `json:"type"`
	ConversationID int    `json:"conversationId"`
	From           string `json:"from"`
}

// MessageReceived avvisa i destinatari di un messaggio nuovo su tutti i browser dove hanno attivato
// le notifiche. Gli errori si registrano e basta: il messaggio è già salvato e la chat lo mostra.
func (s *Service) MessageReceived(ctx context.Context, recipientIDs []string, senderID string, conversationID int) {
	if s.sender == nil || len(recipientIDs) == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, sendTimeout)
	defer cancel()
	from, err := s.store.FirstName(ctx, senderID)
	if err != nil {
		logx.From(ctx).Warn("notifica push: nome del mittente", "err", err)
	}
	payload, err := json.Marshal(messagePayload{Type: "message", ConversationID: conversationID, From: from})
	if err != nil {
		return
	}
	msg := webpush.Message{
		Payload: payload, TTL: messageTTL, Urgency: "high",
		// Più messaggi della stessa conversazione non ancora consegnati: arriva solo l'ultimo
		Topic: "conv-" + strconv.Itoa(conversationID),
	}

	var wg sync.WaitGroup
	for _, userID := range recipientIDs {
		subs, err := s.store.ForUser(ctx, userID, s.now(), auth.SessionIdleDuration)
		if err != nil {
			logx.From(ctx).Warn("notifica push: lettura iscrizioni", "err", err)
			continue
		}
		for _, sub := range subs {
			wg.Add(1)
			go func() {
				defer wg.Done()
				err := s.sender.Send(ctx, sub, msg)
				switch {
				case errors.Is(err, webpush.ErrGone):
					if err := s.store.DeleteEndpoint(context.WithoutCancel(ctx), sub.Endpoint); err != nil {
						logx.From(ctx).Warn("notifica push: iscrizione scaduta non cancellata", "err", err)
					}
				case err != nil:
					logx.From(ctx).Warn("notifica push non inviata", "err", err)
				}
			}()
		}
	}
	wg.Wait()
}
