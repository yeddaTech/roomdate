package webpush

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"
)

// ErrGone indica un'iscrizione che non vale più (revocata dal browser o scaduta): va cancellata.
var ErrGone = errors.New("webpush: iscrizione non più valida")

// Subscription è l'iscrizione di un browser, come la dà PushSubscription.toJSON().
type Subscription struct {
	Endpoint string
	// P256dh e Auth sono in Base64 URL: la chiave pubblica del browser e il segreto condiviso.
	P256dh, Auth string
}

// Message è una notifica da inviare.
type Message struct {
	Payload []byte
	// TTL: per quanto il servizio push la tiene se il dispositivo è spento.
	TTL time.Duration
	// Topic (facoltativo, al massimo 32 caratteri Base64 URL): una notifica nuova con lo stesso
	// argomento sostituisce quella non ancora consegnata.
	Topic string
	// Urgency: "very-low", "low", "normal" o "high".
	Urgency string
}

// I servizi push dei browser (Chrome, Edge, Firefox, Safari): solo a questi il server invia
// richieste. Un indirizzo qualsiasi permetterebbe di far chiamare al server indirizzi interni (SSRF).
var pushHosts = []string{"fcm.googleapis.com", "android.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"}

// Endpoints dice quali indirizzi di iscrizione si accettano.
type Endpoints struct {
	// Extra sono origini in più (es. "http://127.0.0.1:9200"), solo per sviluppo e test.
	Extra []string
}

// Allowed dice se l'indirizzo è di un servizio push conosciuto (https, porta standard).
func (e Endpoints) Allowed(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || u.User != nil {
		return false
	}
	if slices.Contains(e.Extra, u.Scheme+"://"+u.Host) {
		return true
	}
	if u.Scheme != "https" || (u.Port() != "" && u.Port() != "443") {
		return false
	}
	host := strings.ToLower(u.Hostname())
	for _, h := range pushHosts {
		if host == h || strings.HasSuffix(host, "."+h) {
			return true
		}
	}
	return false
}

// Sender invia le notifiche ai servizi push.
type Sender struct {
	keys      *Keys
	subject   string
	endpoints Endpoints
	client    *http.Client
	now       func() time.Time
}

// NewSender crea il mittente con le chiavi VAPID e il contatto del server (subject: l'indirizzo del
// sito o una mailto:).
func NewSender(keys *Keys, subject string, endpoints Endpoints) *Sender {
	return &Sender{
		keys:      keys,
		subject:   subject,
		endpoints: endpoints,
		client: &http.Client{
			Timeout: 5 * time.Second,
			// Niente redirect: porterebbero fuori dai servizi push conosciuti
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		},
		now: time.Now,
	}
}

// PublicKey è la chiave VAPID pubblica, per l'iscrizione nel browser.
func (s *Sender) PublicKey() string {
	return s.keys.PublicKey()
}

// Endpoints dice quali indirizzi di iscrizione accetta questo mittente.
func (s *Sender) Endpoints() Endpoints {
	return s.endpoints
}

// Send cifra e invia una notifica a un'iscrizione. ErrGone: l'iscrizione va cancellata.
func (s *Sender) Send(ctx context.Context, sub Subscription, msg Message) error {
	if !s.endpoints.Allowed(sub.Endpoint) {
		return fmt.Errorf("webpush: indirizzo non ammesso")
	}
	endpoint, err := url.Parse(sub.Endpoint)
	if err != nil {
		return err
	}
	uaPublic, err := b64.DecodeString(strings.TrimRight(sub.P256dh, "="))
	if err != nil {
		return fmt.Errorf("webpush: p256dh: %w", err)
	}
	authSecret, err := b64.DecodeString(strings.TrimRight(sub.Auth, "="))
	if err != nil {
		return fmt.Errorf("webpush: auth: %w", err)
	}
	body, err := Encrypt(msg.Payload, uaPublic, authSecret)
	if err != nil {
		return err
	}
	authorization, err := s.keys.authorization(endpoint, s.subject, s.now())
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sub.Endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", authorization)
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("TTL", strconv.Itoa(int(msg.TTL.Seconds())))
	if msg.Urgency != "" {
		req.Header.Set("Urgency", msg.Urgency)
	}
	if msg.Topic != "" {
		req.Header.Set("Topic", msg.Topic)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	switch {
	case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
		return ErrGone
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return nil
	default:
		return fmt.Errorf("webpush: il servizio push ha risposto %d", resp.StatusCode)
	}
}
