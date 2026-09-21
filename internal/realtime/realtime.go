// Package realtime invia ai client gli eventi in tempo reale tramite Pusher.
package realtime

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/pusher/pusher-http-go/v5"

	"roomdate-backend/internal/config"
	"roomdate-backend/internal/devenv"
)

const EventNewMessage = "nuovo-messaggio"

// Canali privati (modulo M3.5): Pusher accetta l'iscrizione solo con una firma rilasciata dal
// server, che la dà solo a chi ne ha diritto. I canali portano solo ID, mai contenuti.
const (
	// UserChannelPrefix + ID utente: gli avvisi delle conversazioni di quell'utente, solo per lui.
	UserChannelPrefix = "private-user-"
	// ConversationChannelPrefix + ID conversazione: gli eventi che i partecipanti si scambiano
	// direttamente tra i browser, come "sta scrivendo", senza passare dal server.
	ConversationChannelPrefix = "private-conversation-"
)

// UserChannel è il canale di un singolo utente: riceve solo gli eventi delle sue conversazioni,
// invece di un canale unico per tutti (anomalia F12).
func UserChannel(userID string) string {
	return UserChannelPrefix + userID
}

// ConversationChannel è il canale dei partecipanti di una conversazione.
func ConversationChannel(conversationID int) string {
	return ConversationChannelPrefix + strconv.Itoa(conversationID)
}

// ErrDisabled indica che il tempo reale non è configurato (mancano le credenziali Pusher).
var ErrDisabled = errors.New("tempo reale non configurato")

// Authorizer firma l'iscrizione di un client (socketID) a un canale privato. Chi chiama deve
// prima verificare che l'utente abbia diritto a quel canale.
type Authorizer interface {
	Authorize(socketID, channel string) (string, error)
}

// NewAuthorizer restituisce chi firma le iscrizioni con il segreto Pusher; senza credenziali,
// ogni richiesta riceve ErrDisabled.
func NewAuthorizer(cfg config.Pusher) Authorizer {
	if !cfg.Enabled() {
		return disabledAuthorizer{}
	}
	return signer{key: cfg.Key, secret: cfg.Secret}
}

type disabledAuthorizer struct{}

func (disabledAuthorizer) Authorize(string, string) (string, error) { return "", ErrDisabled }

type signer struct{ key, secret string }

// Authorize calcola la firma prevista dal protocollo Pusher: "chiave:HMAC-SHA256(socket:canale)".
func (s signer) Authorize(socketID, channel string) (string, error) {
	mac := hmac.New(sha256.New, []byte(s.secret))
	mac.Write([]byte(socketID + ":" + channel))
	return s.key + ":" + hex.EncodeToString(mac.Sum(nil)), nil
}

// Publisher invia un evento ai client in ascolto su un canale.
type Publisher interface {
	Publish(ctx context.Context, channel, event string, data any) error
}

// New restituisce il publisher Pusher, o uno che non fa nulla se mancano le credenziali
// (sviluppo locale: il frontend aggiorna le chat periodicamente).
func New(cfg config.Pusher) Publisher {
	if !cfg.Enabled() {
		return Noop{}
	}
	return &pusherPublisher{client: &pusher.Client{
		AppID:   cfg.AppID,
		Key:     cfg.Key,
		Secret:  cfg.Secret,
		Cluster: cfg.Cluster,
		// Host serve solo in sviluppo, per un server compatibile con Pusher sulla propria macchina
		// (es. soketi): lì si usa HTTP, altrove sempre HTTPS
		Host:       cfg.Host,
		Secure:     cfg.Host == "" || !devenv.IsLocalHost(cfg.Host),
		HTTPClient: &http.Client{Timeout: 5 * time.Second},
	}}
}

// Noop è il publisher che non invia nulla.
type Noop struct{}

func (Noop) Publish(context.Context, string, string, any) error { return nil }

type pusherPublisher struct {
	client *pusher.Client
}

func (p *pusherPublisher) Publish(_ context.Context, channel, event string, data any) error {
	return p.client.Trigger(channel, event, data)
}
