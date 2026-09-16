package server_test

import (
	"net/http"
	"strings"
	"testing"
)

func TestRoutingAndHeaders(t *testing.T) {
	app := newApp(t)

	rec := app.do(http.MethodGet, "/api/non_esiste", nil)
	expect(t, rec, http.StatusNotFound, "Endpoint non trovato")
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" || rec.Header().Get("Cache-Control") != "no-store" || rec.Header().Get("X-Request-Id") == "" {
		t.Errorf("header = %v", rec.Header())
	}

	// API legacy: errori in testo semplice
	expect(t, app.do(http.MethodPost, "/api/get_listings", nil), http.StatusMethodNotAllowed, "Metodo non consentito")
	expect(t, app.do(http.MethodOptions, "/api/get_listings", nil), http.StatusNoContent, "")

	// API v1: errori in JSON
	expect(t, app.do(http.MethodGet, "/api/v1/auth/login", nil), http.StatusMethodNotAllowed, `"code":"method_not_allowed"`)
	expect(t, app.do(http.MethodPatch, "/api/v1/me", nil), http.StatusMethodNotAllowed, "")
	expect(t, app.do(http.MethodGet, "/api/v1/health", nil), http.StatusOK, `{"status":"ok"}`)
	expect(t, app.do(http.MethodGet, "/api/v1/non_esiste", nil), http.StatusNotFound, `"code":"endpoint_not_found"`)

	// Le vecchie API di accesso e profilo non esistono più
	for _, path := range []string{"/api/login", "/api/register", "/api/profile"} {
		expect(t, app.do(http.MethodGet, path, nil), http.StatusNotFound, "")
	}
}

func TestRequestProtections(t *testing.T) {
	app := newApp(t)
	login := map[string]string{"email": "nessuno@test.it", "password": "x"}

	t.Run("richiesta da altro sito", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/v1/auth/login", login, withHeader("Sec-Fetch-Site", "cross-site"), withHeader("Origin", "https://evil.example"))
		expect(t, rec, http.StatusForbidden, "origine non consentita")
		rec = app.do(http.MethodPost, "/api/v1/auth/login", login, withHeader("Sec-Fetch-Site", "same-origin"))
		expect(t, rec, http.StatusUnauthorized, "")
	})

	t.Run("form HTML invece di JSON", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/v1/auth/password", `{"currentPassword":"x"}`, withHeader("Content-Type", "text/plain"))
		expect(t, rec, http.StatusUnsupportedMediaType, "")
	})

	t.Run("corpo troppo grande", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/v1/auth/register", map[string]string{"bio": strings.Repeat("a", 70<<10)})
		expect(t, rec, http.StatusRequestEntityTooLarge, `"code":"body_too_large"`)
	})

	t.Run("JSON non valido", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/v1/auth/register", "{non json"), http.StatusBadRequest, "Dati non validi")
	})
}
