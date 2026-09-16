// Package validate contiene le regole di validazione dei dati in ingresso e la normalizzazione del testo.
package validate

import (
	"encoding/base64"
	"net/mail"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

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

// Text normalizza un testo scritto dall'utente: toglie gli spazi iniziali e finali e i caratteri
// di controllo invisibili (tranne a capo e tabulazione), ma lo conserva così come è stato scritto,
// compresi "<", ">" e "&". Non serve rimuovere l'HTML: React fa l'escape quando mostra il testo.
func Text(s string) string {
	s = strings.ToValidUTF8(s, "")
	s = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\t' {
			return r
		}
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, s)
	return strings.TrimSpace(s)
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

// DateBetween indica se la stringa è una data AAAA-MM-GG compresa tra min e max (inclusi).
func DateBetween(s string, min, max time.Time) bool {
	t, err := time.Parse(time.DateOnly, s)
	return err == nil && !t.Before(min) && !t.After(max)
}

// PositiveID converte un ID numerico positivo (es. il parametro ?id= di un annuncio).
func PositiveID(s string) (int, bool) {
	n, err := strconv.Atoi(s)
	return n, err == nil && n > 0
}
