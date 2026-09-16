// Package auth gestisce il cookie di sessione (un JWT firmato con HS256) e le password.
package auth

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	CookieName      = "roomdate_session"
	SessionDuration = 24 * time.Hour

	// Blocco temporaneo dell'account dopo troppi tentativi con password errata.
	MaxFailedLogins = 5
	LockDuration    = 15 * time.Minute

	MinPasswordLength = 6
	MaxPasswordBytes  = 72 // bcrypt ignora i byte oltre questo limite
)

// Session è l'identità dell'utente ricavata dal cookie.
// Contiene solo l'ID: ruolo e altri dati si leggono dal database, così una modifica
// del profilo vale subito, senza dover rifare il login.
type Session struct {
	UserID string
}

// Manager emette e verifica i cookie di sessione.
type Manager struct {
	secret        []byte
	secureCookies bool
	now           func() time.Time
}

// NewManager crea il gestore delle sessioni. Il segreto non può essere vuoto.
func NewManager(secret string, secureCookies bool) (*Manager, error) {
	if secret == "" {
		return nil, errors.New("segreto per le sessioni vuoto")
	}
	return &Manager{secret: []byte(secret), secureCookies: secureCookies, now: time.Now}, nil
}

// StartSession firma il token di sessione e lo imposta come cookie HttpOnly.
func (m *Manager) StartSession(w http.ResponseWriter, userID string) error {
	expires := m.now().Add(SessionDuration)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     expires.Unix(),
	})
	signed, err := token.SignedString(m.secret)
	if err != nil {
		return fmt.Errorf("firma del token: %w", err)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    signed,
		Expires:  expires,
		Path:     "/",
		HttpOnly: true,
		Secure:   m.secureCookies,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}

// EndSession chiede al browser di eliminare il cookie di sessione.
func (m *Manager) EndSession(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   m.secureCookies,
		SameSite: http.SameSiteLaxMode,
	})
}

// FromRequest restituisce la sessione del cookie, se presente e valida.
func (m *Manager) FromRequest(r *http.Request) (Session, bool) {
	cookie, err := r.Cookie(CookieName)
	if err != nil {
		return Session{}, false
	}
	session, err := m.Parse(cookie.Value)
	return session, err == nil
}

// Parse verifica firma e scadenza del token. Accetta solo HS256.
func (m *Manager) Parse(tokenString string) (Session, error) {
	token, err := jwt.Parse(tokenString,
		func(*jwt.Token) (any, error) { return m.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(m.now),
	)
	if err != nil {
		return Session{}, err
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return Session{}, errors.New("claims non leggibili")
	}

	var session Session
	switch id := claims["user_id"].(type) {
	case string:
		session.UserID = id
	case float64: // token emessi da versioni precedenti con ID numerico
		session.UserID = fmt.Sprintf("%.0f", id)
	}
	if session.UserID == "" {
		return Session{}, errors.New("ID utente mancante nel token")
	}
	return session, nil
}

// HashPassword calcola l'hash bcrypt della password.
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}

// CheckPassword indica se la password corrisponde all'hash.
func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
