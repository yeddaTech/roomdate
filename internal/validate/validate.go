// Package validate contiene le regole di validazione dei dati in ingresso e la pulizia del testo.
package validate

import (
	"encoding/base64"
	"html"
	"net/mail"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/microcosm-cc/bluemonday"

	"roomdate-backend/internal/apperr"
)

// Validator accumula gli errori di validazione di una richiesta.
type Validator struct {
	fields []apperr.FieldError
}

// Check registra un errore sul campo se la condizione è falsa.
func (v *Validator) Check(ok bool, field, message string) {
	if !ok {
		v.fields = append(v.fields, apperr.FieldError{Field: field, Message: message})
	}
}

// Err restituisce nil se è tutto valido, altrimenti un errore 400 con il primo messaggio
// (e l'elenco completo dei campi, per le API che lo mostrano).
func (v *Validator) Err() error {
	if len(v.fields) == 0 {
		return nil
	}
	return &apperr.Error{
		Status:  400,
		Code:    "validation_failed",
		Message: v.fields[0].Message,
		Fields:  v.fields,
	}
}

// Le policy di bluemonday sono sicure da usare in parallelo.
var strictPolicy = bluemonday.StrictPolicy()

// CleanText rimuove ogni tag HTML e gli spazi iniziali e finali, ma conserva il testo
// così come l'utente l'ha scritto. Da solo, bluemonday restituisce testo già "escapato"
// ("un'amica" → "un&#39;amica") che React mostrerebbe letteralmente: React fa già l'escape in output.
func CleanText(s string) string {
	return strings.TrimSpace(html.UnescapeString(strictPolicy.Sanitize(s)))
}

// NotBlank indica se la stringa contiene almeno un carattere diverso da spazio.
func NotBlank(s string) bool {
	return strings.TrimSpace(s) != ""
}

// MaxLen indica se la stringa ha al massimo n caratteri.
func MaxLen(s string, n int) bool {
	return utf8.RuneCountInString(s) <= n
}

// OneOf indica se la stringa è uno dei valori ammessi.
func OneOf(s string, options ...string) bool {
	for _, option := range options {
		if s == option {
			return true
		}
	}
	return false
}

// Between indica se n è compreso tra min e max (inclusi).
func Between(n, min, max int) bool {
	return n >= min && n <= max
}

// Email indica se la stringa è un indirizzo email semplice (senza nome visualizzato).
func Email(s string) bool {
	if len(s) > 254 {
		return false
	}
	addr, err := mail.ParseAddress(s)
	return err == nil && addr.Address == s
}

// Base64 indica se la stringa è Base64 standard valido e non supera maxLen caratteri.
func Base64(s string, maxLen int) bool {
	if len(s) > maxLen {
		return false
	}
	_, err := base64.StdEncoding.DecodeString(s)
	return err == nil
}

// PastDate indica se la stringa è una data AAAA-MM-GG non futura e non precedente al 1900.
func PastDate(s string, now time.Time) bool {
	t, err := time.Parse(time.DateOnly, s)
	return err == nil && t.Year() >= 1900 && !t.After(now)
}

// PositiveID converte un ID numerico positivo (es. il parametro ?id= di un annuncio).
func PositiveID(s string) (int, bool) {
	n, err := strconv.Atoi(s)
	return n, err == nil && n > 0
}
