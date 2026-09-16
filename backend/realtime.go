package backend

import (
	"os"

	"github.com/pusher/pusher-http-go/v5"
)

// triggerRealtime invia un evento Pusher sul canale globale "roomdate-channel".
// Senza credenziali Pusher (sviluppo locale) non fa nulla: il frontend aggiorna le chat periodicamente.
func triggerRealtime(event string, data interface{}) error {
	appID, key, secret := os.Getenv("PUSHER_APP_ID"), os.Getenv("PUSHER_KEY"), os.Getenv("PUSHER_SECRET")
	if appID == "" || key == "" || secret == "" {
		return nil
	}

	client := pusher.Client{
		AppID:   appID,
		Key:     key,
		Secret:  secret,
		Cluster: os.Getenv("PUSHER_CLUSTER"),
		Secure:  true,
	}
	return client.Trigger("roomdate-channel", event, data)
}
