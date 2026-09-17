// Package page costruisce i cursori della paginazione delle API: una posizione nell'ordinamento,
// resa opaca per chi la riceve. Il contenuto è la chiave di ordinamento seguita dall'ID della riga.
package page

import (
	"encoding/base64"
	"strings"
)

// separator non può comparire nei valori usati come cursore (date, numeri, UUID).
const separator = "|"

// Encode trasforma i campi in un cursore da mettere nell'URL.
func Encode(fields ...string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strings.Join(fields, separator)))
}

// Decode legge un cursore e restituisce i suoi campi. ok è false se il cursore non è valido
// o non ha esattamente il numero di campi attesi: chi chiama deve comunque verificarne il contenuto.
func Decode(cursor string, fields int) ([]string, bool) {
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return nil, false
	}
	parts := strings.Split(string(raw), separator)
	if len(parts) != fields {
		return nil, false
	}
	return parts, true
}
