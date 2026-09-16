// Package httpx contiene i mattoni HTTP comuni: middleware, risposte, errori e decodifica JSON.
package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/logx"
)

// JSON scrive v in formato JSON con lo stato indicato.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// Text scrive un messaggio di testo semplice, come http.Error (formato delle API legacy).
func Text(w http.ResponseWriter, status int, message string) {
	h := w.Header()
	h.Del("Content-Length")
	h.Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(status)
	fmt.Fprintln(w, message)
}

// WriteError scrive la risposta per un errore. Un *apperr.Error mostra il suo messaggio;
// ogni altro errore viene registrato nei log e al client arriva solo un messaggio generico.
// Le API /api/v1 rispondono con {"error": {"code", "message"}}, quelle legacy in testo semplice.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	appErr, ok := apperr.As(err)
	switch {
	case !ok:
		logx.From(r.Context()).Error("errore interno", "err", err)
		appErr = apperr.Internal()
	case appErr.Status >= http.StatusInternalServerError && appErr.Cause != nil:
		logx.From(r.Context()).Error("errore interno", "code", appErr.Code, "err", appErr.Cause)
	}

	if strings.HasPrefix(r.URL.Path, "/api/v1/") {
		JSON(w, appErr.Status, map[string]any{"error": appErr})
		return
	}
	Text(w, appErr.Status, appErr.Message)
}

// DecodeJSON legge il corpo JSON della richiesta in dst.
func DecodeJSON(r *http.Request, dst any) error {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return errBodyTooLarge
		}
		return apperr.BadRequest("invalid_json", "Dati non validi")
	}
	return nil
}

var errBodyTooLarge = apperr.New(http.StatusRequestEntityTooLarge, "body_too_large", "Richiesta troppo grande")

// Methods smista una rotta in base al metodo HTTP: OPTIONS risponde 204,
// i metodi non previsti ricevono 405 con l'header Allow.
func Methods(handlers map[string]http.HandlerFunc) http.Handler {
	allowed := make([]string, 0, len(handlers)+1)
	for method := range handlers {
		allowed = append(allowed, method)
	}
	allowed = append(allowed, http.MethodOptions)
	sort.Strings(allowed)
	allowHeader := strings.Join(allowed, ", ")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if handler, ok := handlers[r.Method]; ok {
			handler(w, r)
			return
		}
		w.Header().Set("Allow", allowHeader)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		WriteError(w, r, apperr.New(http.StatusMethodNotAllowed, "method_not_allowed", "Metodo non consentito"))
	})
}
