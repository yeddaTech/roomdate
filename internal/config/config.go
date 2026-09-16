// Package config legge la configurazione dell'applicazione dalle variabili d'ambiente.
package config

import (
	"fmt"
	"os"
	"strings"

	"roomdate-backend/internal/storage"
)

// Pusher contiene le credenziali per gli eventi in tempo reale (facoltative in sviluppo).
type Pusher struct {
	AppID, Key, Secret, Cluster string
}

// Enabled indica se le credenziali Pusher sono complete.
func (p Pusher) Enabled() bool {
	return p.AppID != "" && p.Key != "" && p.Secret != ""
}

type Config struct {
	DatabaseURL string
	JWTSecret   string
	Pusher      Pusher

	// Storage è lo storage delle foto (Cloudflare R2). Facoltativo: senza, il caricamento foto è disattivato.
	Storage storage.S3Config

	// TrustedOrigins sono origini aggiuntive (es. "https://www.roomdate.it") da cui accettare
	// richieste che modificano dati, oltre a quella del sito stesso.
	TrustedOrigins []string

	// SecureCookies imposta il flag Secure sul cookie di sessione.
	// È false solo nel server di sviluppo locale, che usa HTTP.
	SecureCookies bool
}

// FromEnv legge la configurazione. Restituisce un errore se manca un valore obbligatorio:
// meglio rifiutare le richieste che funzionare con un segreto vuoto.
func FromEnv() (Config, error) {
	cfg := Config{
		DatabaseURL: strings.TrimSpace(os.Getenv("DATABASE_URL")),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		Pusher: Pusher{
			AppID:   os.Getenv("PUSHER_APP_ID"),
			Key:     os.Getenv("PUSHER_KEY"),
			Secret:  os.Getenv("PUSHER_SECRET"),
			Cluster: os.Getenv("PUSHER_CLUSTER"),
		},
		Storage: storage.S3Config{
			Endpoint:        strings.TrimSpace(os.Getenv("R2_ENDPOINT")),
			Bucket:          strings.TrimSpace(os.Getenv("R2_BUCKET")),
			AccessKeyID:     strings.TrimSpace(os.Getenv("R2_ACCESS_KEY_ID")),
			SecretAccessKey: strings.TrimSpace(os.Getenv("R2_SECRET_ACCESS_KEY")),
			PublicURL:       strings.TrimSpace(os.Getenv("R2_PUBLIC_URL")),
		},
		SecureCookies: true,
	}

	for _, origin := range strings.Split(os.Getenv("TRUSTED_ORIGINS"), ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			cfg.TrustedOrigins = append(cfg.TrustedOrigins, origin)
		}
	}

	var missing []string
	if cfg.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if cfg.JWTSecret == "" {
		missing = append(missing, "JWT_SECRET")
	}
	if len(missing) > 0 {
		return cfg, fmt.Errorf("variabili d'ambiente mancanti: %s", strings.Join(missing, ", "))
	}
	return cfg, nil
}
