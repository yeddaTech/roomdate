// Package realtime invia ai client gli eventi in tempo reale tramite Pusher.
package realtime

import (
	"context"
	"net/http"
	"time"

	"github.com/pusher/pusher-http-go/v5"

	"roomdate-backend/internal/config"
)

const (
	EventNewMessage = "nuovo-messaggio"
	EventTyping     = "sta-scrivendo"
)

// UserChannel è il canale di un singolo utente: riceve solo gli eventi delle sue conversazioni,
// invece di un canale unico per tutti (anomalia F12). L'ID è un UUID, quindi non è indovinabile;
// il canale diventa privato e autenticato nel modulo M3.5.
func UserChannel(userID string) string {
	return "user-" + userID
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
		AppID:      cfg.AppID,
		Key:        cfg.Key,
		Secret:     cfg.Secret,
		Cluster:    cfg.Cluster,
		Secure:     true,
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
