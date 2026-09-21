// Package auth gestisce le sessioni e le password.
//
// Il cookie contiene solo un numero casuale da 256 bit; il database ne conserva l'impronta,
// insieme a scadenza e ultimo utilizzo. Rispetto a un token firmato (JWT) questo permette
// di revocare davvero una sessione, e chi legge il database non può fabbricarne di nuove.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"
)

const (
	// Nome del cookie. Il prefisso __Host- è accettato dal browser solo su HTTPS, con Path=/
	// e senza Domain: nessun sottodominio può quindi sovrascrivere la sessione.
	// In sviluppo locale, senza HTTPS, il prefisso non è ammesso e si usa il nome semplice.
	secureCookieName = "__Host-roomdate_session"
	devCookieName    = "roomdate_session"

	// Scadenza assoluta della sessione e scadenza per inattività.
	SessionDuration     = 30 * 24 * time.Hour
	SessionIdleDuration = 7 * 24 * time.Hour
	// Ogni quanto aggiornare "ultimo utilizzo": senza questo margine ogni richiesta scriverebbe.
	touchInterval = 5 * time.Minute

	MinPasswordLength = 10
	// Le password più lunghe di così non aggiungono sicurezza e occupano solo lavoro di calcolo.
	MaxPasswordBytes = 128
)

// Session è l'identità di chi fa la richiesta, ricavata dal cookie.
// Contiene solo gli ID: ruolo e dati del profilo si leggono dal database a ogni richiesta.
type Session struct {
	// ID identifica la sessione (serve a revocarla).
	ID     string
	UserID string
}

// Manager emette, verifica e revoca le sessioni.
type Manager struct {
	store         *Store
	secret        []byte
	secureCookies bool
	now           func() time.Time
}

// NewManager crea il gestore delle sessioni. Il segreto serve a calcolare le impronte
// degli indirizzi IP nel registro di sicurezza e non può essere vuoto.
func NewManager(store *Store, secret string, secureCookies bool) (*Manager, error) {
	if secret == "" {
		return nil, errors.New("segreto dell'applicazione vuoto")
	}
	if store == nil {
		return nil, errors.New("store delle sessioni mancante")
	}
	return &Manager{store: store, secret: []byte(secret), secureCookies: secureCookies, now: time.Now}, nil
}

// CookieName è il nome del cookie di sessione in uso.
func (m *Manager) CookieName() string {
	if m.secureCookies {
		return secureCookieName
	}
	return devCookieName
}

// StartSession crea una sessione per l'utente e la mette nel cookie.
func (m *Manager) StartSession(ctx context.Context, w http.ResponseWriter, r *http.Request, userID string) error {
	token, err := newToken()
	if err != nil {
		return err
	}
	now := m.now()
	expires := now.Add(SessionDuration)
	err = m.store.CreateSession(ctx, NewSession{
		UserID:    userID,
		TokenHash: hashToken(token),
		ExpiresAt: expires,
		UserAgent: deviceLabel(r.UserAgent()),
	})
	if err != nil {
		return err
	}

	m.setCookie(w, token, expires)
	return nil
}

// EndSession revoca la sessione indicata e cancella il cookie.
func (m *Manager) EndSession(ctx context.Context, w http.ResponseWriter, session Session) error {
	m.setCookie(w, "", time.Unix(0, 0))
	if session.ID == "" {
		return nil
	}
	return m.store.DeleteSession(ctx, session.ID)
}

// ClearCookie cancella il cookie senza toccare il database (sessione già scaduta o inesistente).
func (m *Manager) ClearCookie(w http.ResponseWriter) {
	m.setCookie(w, "", time.Unix(0, 0))
}

func (m *Manager) setCookie(w http.ResponseWriter, value string, expires time.Time) {
	cookie := &http.Cookie{
		Name:     m.CookieName(),
		Value:    value,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		Secure:   m.secureCookies,
		SameSite: http.SameSiteLaxMode,
	}
	if value == "" {
		cookie.MaxAge = -1
	}
	http.SetCookie(w, cookie)
}

// FromRequest restituisce la sessione del cookie, se esiste ed è ancora valida.
// Aggiorna "ultimo utilizzo", che serve alla scadenza per inattività.
func (m *Manager) FromRequest(ctx context.Context, r *http.Request) (Session, bool) {
	cookie, err := r.Cookie(m.CookieName())
	if err != nil || cookie.Value == "" {
		return Session{}, false
	}
	stored, err := m.store.SessionByHash(ctx, hashToken(cookie.Value))
	if err != nil {
		return Session{}, false
	}

	now := m.now()
	if now.After(stored.ExpiresAt) || now.Sub(stored.LastUsedAt) > SessionIdleDuration {
		// La riga resta: viene eliminata dalla pulizia periodica delle sessioni scadute
		return Session{}, false
	}
	if now.Sub(stored.LastUsedAt) > touchInterval {
		_ = m.store.TouchSession(ctx, stored.ID, now)
	}
	return Session{ID: stored.ID, UserID: stored.UserID}, true
}

// Sessions restituisce le sessioni attive dell'utente, dalla più usata di recente.
func (m *Manager) Sessions(ctx context.Context, userID string) ([]StoredSession, error) {
	return m.store.SessionsFor(ctx, userID, m.now(), SessionIdleDuration)
}

// RevokeSession revoca una sessione dell'utente; ok è false se non esiste o non è sua.
func (m *Manager) RevokeSession(ctx context.Context, userID, sessionID string) (bool, error) {
	return m.store.DeleteUserSession(ctx, userID, sessionID)
}

// RevokeAllSessions revoca tutte le sessioni dell'utente, compresa quella in uso.
func (m *Manager) RevokeAllSessions(ctx context.Context, userID string) error {
	return m.store.DeleteAllUserSessions(ctx, userID)
}

// RevokeOtherSessions revoca tutte le altre sessioni dell'utente e restituisce quante ne ha chiuse.
func (m *Manager) RevokeOtherSessions(ctx context.Context, userID, keepSessionID string) (int, error) {
	return m.store.DeleteUserSessions(ctx, userID, keepSessionID)
}

// IPHash è l'impronta dell'indirizzo di provenienza, da salvare nel registro di sicurezza
// al posto dell'indirizzo: basta a contare i tentativi, ma non permette di risalire a chi li ha fatti.
func (m *Manager) IPHash(r *http.Request) string {
	return m.Hash(clientIP(r))
}

// Hash calcola l'impronta di un valore con il segreto dell'applicazione (email, indirizzi IP).
func (m *Manager) Hash(value string) string {
	if value == "" {
		return ""
	}
	sum := sha256.Sum256(append(m.secret, strings.ToLower(value)...))
	return hex.EncodeToString(sum[:])
}

// clientIP legge l'indirizzo del client dietro il proxy di Vercel.
func clientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		if first, _, found := strings.Cut(forwarded, ","); found {
			return strings.TrimSpace(first)
		}
		return strings.TrimSpace(forwarded)
	}
	host, _, found := strings.Cut(r.RemoteAddr, ":")
	if !found {
		return r.RemoteAddr
	}
	return host
}

// newToken genera il valore del cookie: 256 bit casuali.
func newToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

// hashToken calcola l'impronta salvata nel database. Il token è già casuale,
// quindi non serve una funzione lenta: nessuno può indovinarlo partendo dall'impronta.
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// deviceLabel riassume il browser per far riconoscere la sessione a chi la revoca.
func deviceLabel(userAgent string) string {
	if userAgent == "" {
		return "Dispositivo sconosciuto"
	}
	browser := "Browser"
	switch {
	case strings.Contains(userAgent, "Edg/"):
		browser = "Edge"
	case strings.Contains(userAgent, "OPR/"):
		browser = "Opera"
	case strings.Contains(userAgent, "Firefox/"):
		browser = "Firefox"
	case strings.Contains(userAgent, "Chrome/"):
		browser = "Chrome"
	case strings.Contains(userAgent, "Safari/"):
		browser = "Safari"
	}
	system := ""
	switch {
	case strings.Contains(userAgent, "Android"):
		system = "Android"
	case strings.Contains(userAgent, "iPhone"), strings.Contains(userAgent, "iPad"):
		system = "iOS"
	case strings.Contains(userAgent, "Windows"):
		system = "Windows"
	case strings.Contains(userAgent, "Mac OS"):
		system = "Mac"
	case strings.Contains(userAgent, "Linux"):
		system = "Linux"
	}
	if system == "" {
		return browser
	}
	return browser + " su " + system
}
