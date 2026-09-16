package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"roomdate-backend/internal/apperr"
)

var discardLogger = slog.New(slog.NewTextHandler(io.Discard, nil))

func ok(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func TestChainAppliesMiddlewaresInOrder(t *testing.T) {
	var order []string
	mark := func(name string) Middleware {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				order = append(order, name)
				next.ServeHTTP(w, r)
			})
		}
	}
	h := Chain(http.HandlerFunc(ok), mark("esterno"), mark("interno"))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	if strings.Join(order, ",") != "esterno,interno" {
		t.Fatalf("ordine = %v", order)
	}
}

func TestRequestIDSetsHeader(t *testing.T) {
	rec := httptest.NewRecorder()
	RequestID(discardLogger)(http.HandlerFunc(ok)).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if id := rec.Header().Get("X-Request-Id"); len(id) != 16 {
		t.Fatalf("X-Request-Id = %q, attesi 16 caratteri esadecimali", id)
	}
}

func TestRecoverTurnsPanicInto500(t *testing.T) {
	panicking := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom: dettaglio interno") })
	rec := httptest.NewRecorder()
	Recover()(panicking).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/login", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("stato = %d", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "boom") {
		t.Fatalf("il dettaglio del panic è finito nella risposta: %q", rec.Body.String())
	}
}

func TestSecurityHeaders(t *testing.T) {
	rec := httptest.NewRecorder()
	SecurityHeaders()(http.HandlerFunc(ok)).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	for header, want := range map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"Cache-Control":          "no-store",
	} {
		if got := rec.Header().Get(header); got != want {
			t.Errorf("%s = %q, atteso %q", header, got, want)
		}
	}
}

func TestLimitBody(t *testing.T) {
	decode := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var v map[string]any
		if err := DecodeJSON(r, &v); err != nil {
			WriteError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusOK)
	})
	h := LimitBody(32)(decode)

	t.Run("Content-Length oltre il limite", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/x", strings.NewReader(`{"a":"`+strings.Repeat("x", 100)+`"}`)))
		if rec.Code != http.StatusRequestEntityTooLarge {
			t.Fatalf("stato = %d", rec.Code)
		}
	})

	t.Run("corpo senza Content-Length oltre il limite", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/x", io.NopCloser(strings.NewReader(`{"a":"`+strings.Repeat("x", 100)+`"}`)))
		req.ContentLength = -1
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusRequestEntityTooLarge {
			t.Fatalf("stato = %d", rec.Code)
		}
	})

	t.Run("corpo entro il limite", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/x", strings.NewReader(`{"a":1}`)))
		if rec.Code != http.StatusOK {
			t.Fatalf("stato = %d", rec.Code)
		}
	})
}

func TestRequireJSON(t *testing.T) {
	h := RequireJSON()(http.HandlerFunc(ok))
	cases := []struct {
		method, contentType, body string
		want                      int
	}{
		{http.MethodPost, "application/json", "{}", http.StatusOK},
		{http.MethodPost, "application/json; charset=utf-8", "{}", http.StatusOK},
		{http.MethodPost, "text/plain", "{}", http.StatusUnsupportedMediaType},
		{http.MethodPost, "application/x-www-form-urlencoded", "{}", http.StatusUnsupportedMediaType},
		{http.MethodPost, "", "{}", http.StatusUnsupportedMediaType},
		{http.MethodPatch, "multipart/form-data", "{}", http.StatusUnsupportedMediaType},
		{http.MethodPut, "", "", http.StatusOK},
		{http.MethodGet, "", "{}", http.StatusOK},
		{http.MethodDelete, "", "{}", http.StatusOK},
	}
	for _, c := range cases {
		req := httptest.NewRequest(c.method, "/api/x", strings.NewReader(c.body))
		if c.contentType != "" {
			req.Header.Set("Content-Type", c.contentType)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != c.want {
			t.Errorf("%s con Content-Type %q: stato = %d, atteso %d", c.method, c.contentType, rec.Code, c.want)
		}
	}
}

func TestCrossOriginProtection(t *testing.T) {
	mw, err := CrossOriginProtection([]string{"https://www.roomdate.it"})
	if err != nil {
		t.Fatal(err)
	}
	h := mw(http.HandlerFunc(ok))

	cases := []struct {
		name, method string
		headers      map[string]string
		want         int
	}{
		{"POST dallo stesso sito", http.MethodPost, map[string]string{"Sec-Fetch-Site": "same-origin"}, http.StatusOK},
		{"POST da altro sito", http.MethodPost, map[string]string{"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.example"}, http.StatusForbidden},
		{"DELETE da altro sito", http.MethodDelete, map[string]string{"Sec-Fetch-Site": "cross-site"}, http.StatusForbidden},
		{"Origin diverso senza Sec-Fetch-Site", http.MethodPost, map[string]string{"Origin": "https://evil.example"}, http.StatusForbidden},
		{"Origin uguale all'host", http.MethodPost, map[string]string{"Origin": "http://roomdate.test"}, http.StatusOK},
		{"origine aggiuntiva consentita", http.MethodPost, map[string]string{"Sec-Fetch-Site": "cross-site", "Origin": "https://www.roomdate.it"}, http.StatusOK},
		{"client non browser (nessun header)", http.MethodPost, nil, http.StatusOK},
		{"GET da altro sito", http.MethodGet, map[string]string{"Sec-Fetch-Site": "cross-site"}, http.StatusOK},
	}
	for _, c := range cases {
		req := httptest.NewRequest(c.method, "http://roomdate.test/api/x", nil)
		for k, v := range c.headers {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != c.want {
			t.Errorf("%s: stato = %d, atteso %d", c.name, rec.Code, c.want)
		}
	}

	if _, err := CrossOriginProtection([]string{"non-un-url"}); err == nil {
		t.Error("un'origine non valida dovrebbe essere rifiutata")
	}
}

func TestMethods(t *testing.T) {
	h := Methods(map[string]http.HandlerFunc{http.MethodGet: ok, http.MethodPost: ok})

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPut, "/api/profile", nil))
	if rec.Code != http.StatusMethodNotAllowed || rec.Header().Get("Allow") != "GET, OPTIONS, POST" {
		t.Fatalf("PUT: stato = %d, Allow = %q", rec.Code, rec.Header().Get("Allow"))
	}
	if !strings.Contains(rec.Body.String(), "Metodo non consentito") {
		t.Errorf("messaggio = %q", rec.Body.String())
	}

	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodOptions, "/api/profile", nil))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("OPTIONS: stato = %d", rec.Code)
	}
}

func TestWriteError(t *testing.T) {
	t.Run("API legacy: testo semplice", func(t *testing.T) {
		rec := httptest.NewRecorder()
		WriteError(rec, httptest.NewRequest(http.MethodGet, "/api/login", nil), apperr.NotFound("x", "Non trovato"))
		if rec.Code != http.StatusNotFound || strings.TrimSpace(rec.Body.String()) != "Non trovato" {
			t.Fatalf("stato = %d, corpo = %q", rec.Code, rec.Body.String())
		}
	})

	t.Run("API v1: JSON", func(t *testing.T) {
		rec := httptest.NewRecorder()
		WriteError(rec, httptest.NewRequest(http.MethodGet, "/api/v1/health", nil), apperr.BadRequest("bad", "Richiesta non valida"))
		var body struct {
			Error apperr.Error `json:"error"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if rec.Code != http.StatusBadRequest || body.Error.Code != "bad" || body.Error.Message != "Richiesta non valida" {
			t.Fatalf("stato = %d, corpo = %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("errore interno: nessun dettaglio al client", func(t *testing.T) {
		for _, err := range []error{
			errors.New("pq: password authentication failed"),
			apperr.Wrap(errors.New("violates foreign key constraint"), "delete_failed", "Impossibile eliminare"),
		} {
			rec := httptest.NewRecorder()
			WriteError(rec, httptest.NewRequest(http.MethodGet, "/api/x", nil), err)
			if rec.Code != http.StatusInternalServerError || strings.Contains(rec.Body.String(), "pq:") || strings.Contains(rec.Body.String(), "constraint") {
				t.Fatalf("stato = %d, corpo = %q", rec.Code, rec.Body.String())
			}
		}
	})
}
