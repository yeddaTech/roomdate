package httpx

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"mime"
	"net/http"
	"runtime/debug"
	"time"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/logx"
)

// Middleware avvolge un handler aggiungendo un comportamento comune.
type Middleware func(http.Handler) http.Handler

// Chain applica i middleware nell'ordine indicato: il primo è il più esterno.
func Chain(h http.Handler, middlewares ...Middleware) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}

// RequestID assegna un identificativo casuale a ogni richiesta, lo restituisce nell'header
// X-Request-Id e lo aggiunge al logger del contesto: così un errore segnalato da un utente
// si ritrova nei log.
func RequestID(base *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := newRequestID()
			w.Header().Set("X-Request-Id", id)
			ctx := logx.With(r.Context(), base.With("request_id", id))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func newRequestID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// Logging registra metodo, percorso, stato e durata di ogni richiesta.
// Il percorso è senza query string, che può contenere ID o altri dati personali.
func Logging() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(sw, r)

			level := slog.LevelInfo
			if sw.status >= 500 {
				level = slog.LevelWarn
			}
			logx.From(r.Context()).Log(r.Context(), level, "richiesta",
				"method", r.Method,
				"path", r.URL.Path,
				"status", sw.status,
				"duration_ms", time.Since(start).Milliseconds(),
			)
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (w *statusWriter) WriteHeader(status int) {
	if !w.wroteHeader {
		w.status = status
		w.wroteHeader = true
	}
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	w.wroteHeader = true
	return w.ResponseWriter.Write(b)
}

func (w *statusWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

// Recover trasforma un panic in una risposta 500, registrando lo stack nei log.
func Recover() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				v := recover()
				if v == nil {
					return
				}
				if v == http.ErrAbortHandler {
					panic(v)
				}
				logx.From(r.Context()).Error("panic", "value", fmt.Sprint(v), "stack", string(debug.Stack()))
				WriteError(w, r, apperr.Internal())
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// SecurityHeaders aggiunge gli header di sicurezza delle risposte API.
// Cache-Control: no-store evita che risposte con dati personali finiscano in una cache.
func SecurityHeaders() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("X-Frame-Options", "DENY")
			h.Set("Cache-Control", "no-store")
			next.ServeHTTP(w, r)
		})
	}
}

// LimitBody rifiuta i corpi più grandi di maxBytes (413).
func LimitBody(maxBytes int64) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.ContentLength > maxBytes {
				WriteError(w, r, errBodyTooLarge)
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			next.ServeHTTP(w, r)
		})
	}
}

// RequireJSON accetta i corpi di POST, PUT e PATCH solo con Content-Type application/json (415).
// Oltre a validare il formato, impedisce gli invii da form HTML di altri siti.
// Le richieste senza corpo passano: il metodo o i dati mancanti vengono gestiti dalla rotta.
func RequireJSON() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.ContentLength == 0 {
				next.ServeHTTP(w, r)
				return
			}
			switch r.Method {
			case http.MethodPost, http.MethodPut, http.MethodPatch:
				mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
				if err != nil || mediaType != "application/json" {
					WriteError(w, r, apperr.New(http.StatusUnsupportedMediaType, "unsupported_media_type",
						"Formato non supportato: invia i dati in JSON"))
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// CrossOriginProtection blocca le richieste che modificano dati provenienti da altri siti (CSRF),
// usando gli header Sec-Fetch-Site e Origin inviati dai browser. trustedOrigins sono origini
// aggiuntive consentite (es. "https://www.roomdate.it").
func CrossOriginProtection(trustedOrigins []string) (Middleware, error) {
	protection := http.NewCrossOriginProtection()
	for _, origin := range trustedOrigins {
		if err := protection.AddTrustedOrigin(origin); err != nil {
			return nil, fmt.Errorf("origine non valida in TRUSTED_ORIGINS %q: %w", origin, err)
		}
	}
	protection.SetDenyHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		WriteError(w, r, apperr.Forbidden("cross_origin_request", "Richiesta da un'origine non consentita"))
	}))
	return protection.Handler, nil
}
