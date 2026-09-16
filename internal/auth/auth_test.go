package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "segreto-di-test"

func newTestManager(t *testing.T, secure bool) *Manager {
	t.Helper()
	m, err := NewManager(testSecret, secure)
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func sessionCookie(t *testing.T, rec *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range rec.Result().Cookies() {
		if c.Name == CookieName {
			return c
		}
	}
	t.Fatal("cookie di sessione assente")
	return nil
}

func TestNewManagerRejectsEmptySecret(t *testing.T) {
	if _, err := NewManager("", true); err == nil {
		t.Fatal("un segreto vuoto deve essere rifiutato")
	}
}

func TestSessionRoundTrip(t *testing.T) {
	m := newTestManager(t, true)
	rec := httptest.NewRecorder()
	if err := m.StartSession(rec, "42", "affitta"); err != nil {
		t.Fatal(err)
	}

	cookie := sessionCookie(t, rec)
	if !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteLaxMode || cookie.Path != "/" {
		t.Errorf("attributi del cookie = %+v", cookie)
	}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(cookie)
	session, ok := m.FromRequest(req)
	if !ok || session.UserID != "42" || session.UserType != "affitta" {
		t.Fatalf("sessione = %+v, ok = %v", session, ok)
	}
}

func TestInsecureCookiesForLocalDevelopment(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestManager(t, false).StartSession(rec, "1", "cerca")
	if sessionCookie(t, rec).Secure {
		t.Fatal("in sviluppo il cookie non deve avere Secure")
	}
}

func TestEndSessionClearsCookie(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestManager(t, true).EndSession(rec)
	cookie := sessionCookie(t, rec)
	if cookie.Value != "" || cookie.MaxAge >= 0 {
		t.Fatalf("cookie = %+v", cookie)
	}
}

func TestParseRejectsInvalidTokens(t *testing.T) {
	m := newTestManager(t, true)
	now := time.Now()

	sign := func(method jwt.SigningMethod, key any, claims jwt.MapClaims) string {
		s, err := jwt.NewWithClaims(method, claims).SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	valid := jwt.MapClaims{"user_id": "1", "exp": now.Add(time.Hour).Unix()}

	cases := map[string]string{
		"firma con altro segreto": sign(jwt.SigningMethodHS256, []byte("altro"), valid),
		"algoritmo none":          sign(jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, valid),
		"algoritmo HS512":         sign(jwt.SigningMethodHS512, []byte(testSecret), valid),
		"scaduto":                 sign(jwt.SigningMethodHS256, []byte(testSecret), jwt.MapClaims{"user_id": "1", "exp": now.Add(-time.Minute).Unix()}),
		"senza scadenza":          sign(jwt.SigningMethodHS256, []byte(testSecret), jwt.MapClaims{"user_id": "1"}),
		"senza user_id":           sign(jwt.SigningMethodHS256, []byte(testSecret), jwt.MapClaims{"exp": now.Add(time.Hour).Unix()}),
		"stringa casuale":         "non.un.token",
	}
	for name, token := range cases {
		if _, err := m.Parse(token); err == nil {
			t.Errorf("%s: token accettato", name)
		}
	}
}

func TestParseAcceptsNumericUserIDFromOlderTokens(t *testing.T) {
	m := newTestManager(t, true)
	token, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": 7, "user_type": "cerca", "exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString([]byte(testSecret))

	session, err := m.Parse(token)
	if err != nil || session.UserID != "7" {
		t.Fatalf("sessione = %+v, err = %v", session, err)
	}
}

func TestPasswords(t *testing.T) {
	hash, err := HashPassword("vecchiapass")
	if err != nil {
		t.Fatal(err)
	}
	if !CheckPassword(hash, "vecchiapass") || CheckPassword(hash, "sbagliata") {
		t.Fatal("verifica della password errata")
	}
}
