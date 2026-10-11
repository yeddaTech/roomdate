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
	// Host (facoltativo, solo sviluppo) è un server compatibile con Pusher in locale, es. "127.0.0.1:6001".
	Host string
}

// Enabled indica se le credenziali Pusher sono complete.
func (p Pusher) Enabled() bool {
	return p.AppID != "" && p.Key != "" && p.Secret != ""
}

type Config struct {
	DatabaseURL string
	// SecretKey è il segreto dell'applicazione. Dal modulo M3.2 le sessioni non sono più token
	// firmati, quindi serve solo a calcolare le impronte di email e indirizzi IP nel registro
	// di sicurezza. Si legge da APP_SECRET, o da JWT_SECRET per le installazioni precedenti.
	SecretKey string
	Pusher    Pusher

	// Storage è lo storage delle foto (Cloudflare R2). Facoltativo: senza, il caricamento foto è disattivato.
	Storage storage.S3Config

	// TrustedOrigins sono origini aggiuntive (es. "https://www.roomdate.it") da cui accettare
	// richieste che modificano dati, oltre a quella del sito stesso.
	TrustedOrigins []string

	// SecureCookies imposta il flag Secure sul cookie di sessione.
	// È false solo nel server di sviluppo locale, che usa HTTP.
	SecureCookies bool

	// SiteURL è l'indirizzo pubblico del sito, senza "/" finale: serve agli indirizzi completi della
	// mappa del sito e delle anteprime dei link condivisi. Da SITE_URL, altrimenti quello su Vercel.
	SiteURL string

	// Push sono le notifiche push dei messaggi, facoltative: senza chiave restano spente.
	Push Push
}

// Push contiene la configurazione delle notifiche push (modulo M2.8).
type Push struct {
	// PrivateKey è la chiave VAPID privata (VAPID_PRIVATE_KEY), creata con "go run ./cmd/vapid";
	// la pubblica si ricava da questa.
	PrivateKey string
	// Subject è il contatto del server per i servizi push (VAPID_SUBJECT): una mailto: o
	// l'indirizzo del sito, che è il valore predefinito.
	Subject string
	// TestOrigins sono servizi push finti ammessi oltre a quelli veri (PUSH_TEST_ORIGINS, es.
	// "http://127.0.0.1:9200"): solo per sviluppo e test, mai in produzione.
	TestOrigins []string
}

// DefaultSiteURL è l'indirizzo del sito pubblicato (lo stesso di index.html e robots.txt).
const DefaultSiteURL = "https://roomdate.vercel.app"

// FromEnv legge la configurazione. Restituisce un errore se manca un valore obbligatorio:
// meglio rifiutare le richieste che funzionare con un segreto vuoto.
func FromEnv() (Config, error) {
	cfg := Config{
		DatabaseURL: strings.TrimSpace(os.Getenv("DATABASE_URL")),
		SecretKey:   firstNonEmpty(os.Getenv("APP_SECRET"), os.Getenv("JWT_SECRET")),
		Pusher: Pusher{
			AppID:   os.Getenv("PUSHER_APP_ID"),
			Key:     os.Getenv("PUSHER_KEY"),
			Secret:  os.Getenv("PUSHER_SECRET"),
			Cluster: os.Getenv("PUSHER_CLUSTER"),
			Host:    strings.TrimSpace(os.Getenv("PUSHER_HOST")),
		},
		Storage: storage.S3Config{
			Endpoint:        strings.TrimSpace(os.Getenv("R2_ENDPOINT")),
			Bucket:          strings.TrimSpace(os.Getenv("R2_BUCKET")),
			AccessKeyID:     strings.TrimSpace(os.Getenv("R2_ACCESS_KEY_ID")),
			SecretAccessKey: strings.TrimSpace(os.Getenv("R2_SECRET_ACCESS_KEY")),
			PublicURL:       strings.TrimSpace(os.Getenv("R2_PUBLIC_URL")),
		},
		SecureCookies: true,
		SiteURL:       strings.TrimRight(firstNonEmpty(os.Getenv("SITE_URL"), DefaultSiteURL), "/"),
		Push: Push{
			PrivateKey: strings.TrimSpace(os.Getenv("VAPID_PRIVATE_KEY")),
			Subject:    strings.TrimSpace(os.Getenv("VAPID_SUBJECT")),
		},
	}
	for _, origin := range strings.Split(os.Getenv("PUSH_TEST_ORIGINS"), ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			cfg.Push.TestOrigins = append(cfg.Push.TestOrigins, origin)
		}
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
	if cfg.SecretKey == "" {
		missing = append(missing, "APP_SECRET")
	}
	if len(missing) > 0 {
		return cfg, fmt.Errorf("variabili d'ambiente mancanti: %s", strings.Join(missing, ", "))
	}
	return cfg, nil
}

// firstNonEmpty restituisce il primo valore non vuoto.
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
