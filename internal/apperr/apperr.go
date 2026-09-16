// Package apperr definisce gli errori "attesi" dell'applicazione: hanno uno stato HTTP,
// un codice stabile e un messaggio in italiano che si può mostrare all'utente.
// Ogni altro errore è considerato interno: finisce nei log e non arriva mai al client.
package apperr

import (
	"errors"
	"net/http"
)

// FieldError descrive un campo non valido.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Error è un errore con stato HTTP e messaggio per l'utente.
type Error struct {
	Status  int          `json:"-"`
	Code    string       `json:"code"`
	Message string       `json:"message"`
	Fields  []FieldError `json:"fields,omitempty"`

	// Cause è l'errore tecnico originale: finisce nei log, mai nella risposta.
	Cause error `json:"-"`
}

func (e *Error) Error() string {
	if e.Cause != nil {
		return e.Code + ": " + e.Message + ": " + e.Cause.Error()
	}
	return e.Code + ": " + e.Message
}

func (e *Error) Unwrap() error {
	return e.Cause
}

// New crea un errore con stato, codice e messaggio.
func New(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}

// Wrap crea un errore interno (500) con un messaggio specifico per l'utente e la causa tecnica.
func Wrap(cause error, code, message string) *Error {
	return &Error{Status: http.StatusInternalServerError, Code: code, Message: message, Cause: cause}
}

func BadRequest(code, message string) *Error {
	return New(http.StatusBadRequest, code, message)
}

func Unauthorized(code, message string) *Error {
	return New(http.StatusUnauthorized, code, message)
}

func Forbidden(code, message string) *Error {
	return New(http.StatusForbidden, code, message)
}

func NotFound(code, message string) *Error {
	return New(http.StatusNotFound, code, message)
}

func Conflict(code, message string) *Error {
	return New(http.StatusConflict, code, message)
}

func TooManyRequests(code, message string) *Error {
	return New(http.StatusTooManyRequests, code, message)
}

// Internal è la risposta generica per gli errori imprevisti.
func Internal() *Error {
	return New(http.StatusInternalServerError, "internal_error", "Errore interno del server")
}

// As estrae un *Error dalla catena di errori.
func As(err error) (*Error, bool) {
	var e *Error
	ok := errors.As(err, &e)
	return e, ok
}
