// Package storage salva i file caricati dagli utenti (le foto degli annunci) in uno storage
// compatibile S3: in produzione Cloudflare R2.
//
// Il browser carica i file direttamente sullo storage con un URL firmato a scadenza, senza passare
// dalle funzioni Vercel: il server firma, poi verifica l'oggetto caricato prima di accettarlo.
package storage

import (
	"context"
	"errors"
	"time"
)

var (
	// ErrDisabled indica che lo storage non è configurato (ad esempio in sviluppo senza chiavi R2).
	ErrDisabled = errors.New("storage non configurato")
	// ErrNotFound indica che l'oggetto non esiste.
	ErrNotFound = errors.New("oggetto non trovato")
)

// ObjectInfo descrive un oggetto salvato.
type ObjectInfo struct {
	Size        int64
	ContentType string
}

// Upload è un caricamento autorizzato: il browser invia il file con una PUT a URL, con gli header indicati.
type Upload struct {
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
}

type Storage interface {
	// PresignUpload autorizza il caricamento di un oggetto con il tipo indicato, per una durata limitata.
	PresignUpload(ctx context.Context, key, contentType string, expires time.Duration) (Upload, error)
	// Stat restituisce dimensione e tipo di un oggetto, o ErrNotFound.
	Stat(ctx context.Context, key string) (ObjectInfo, error)
	// ReadPrefix legge i primi n byte di un oggetto (per riconoscere il formato del file).
	ReadPrefix(ctx context.Context, key string, n int) ([]byte, error)
	// Move sposta un oggetto su una nuova chiave.
	Move(ctx context.Context, from, to string) error
	// Delete elimina un oggetto; non è un errore se non esiste.
	Delete(ctx context.Context, key string) error
	// PublicURL è l'indirizzo pubblico da cui il browser scarica l'oggetto.
	PublicURL(key string) string
}

// Disabled è lo storage usato quando mancano le credenziali: ogni operazione restituisce ErrDisabled.
type Disabled struct{}

func (Disabled) PresignUpload(context.Context, string, string, time.Duration) (Upload, error) {
	return Upload{}, ErrDisabled
}
func (Disabled) Stat(context.Context, string) (ObjectInfo, error)        { return ObjectInfo{}, ErrDisabled }
func (Disabled) ReadPrefix(context.Context, string, int) ([]byte, error) { return nil, ErrDisabled }
func (Disabled) Move(context.Context, string, string) error              { return ErrDisabled }
func (Disabled) Delete(context.Context, string) error                    { return ErrDisabled }
func (Disabled) PublicURL(string) string                                 { return "" }
