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

	expect(t, app.do(http.MethodPut, "/api/profile", nil), http.StatusMethodNotAllowed, "Metodo non consentito")
	expect(t, app.do(http.MethodGet, "/api/login", nil), http.StatusMethodNotAllowed, "")
	expect(t, app.do(http.MethodOptions, "/api/login", nil), http.StatusNoContent, "")

	rec = app.do(http.MethodGet, "/api/v1/health", nil)
	expect(t, rec, http.StatusOK, `{"status":"ok"}`)

	rec = app.do(http.MethodGet, "/api/v1/non_esiste", nil)
	expect(t, rec, http.StatusNotFound, `"code":"endpoint_not_found"`)
}

func TestRequestProtections(t *testing.T) {
	app := newApp(t)
	login := map[string]string{"email": "nessuno@test.it", "password": "x"}

	t.Run("richiesta da altro sito", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/login", login, withHeader("Sec-Fetch-Site", "cross-site"), withHeader("Origin", "https://evil.example"))
		expect(t, rec, http.StatusForbidden, "origine non consentita")
		rec = app.do(http.MethodPost, "/api/login", login, withHeader("Sec-Fetch-Site", "same-origin"))
		expect(t, rec, http.StatusUnauthorized, "")
	})

	t.Run("form HTML invece di JSON", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/login", `{"action":"delete_account"}`, withHeader("Content-Type", "text/plain"))
		expect(t, rec, http.StatusUnsupportedMediaType, "")
	})

	t.Run("corpo troppo grande", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/register", map[string]string{"bio": strings.Repeat("a", 70<<10)})
		expect(t, rec, http.StatusRequestEntityTooLarge, "")
	})

	t.Run("JSON non valido", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/register", "{non json"), http.StatusBadRequest, "Dati non validi")
	})
}
