// Package shared contiene gli elenchi di valori ammessi usati sia dal backend sia dal frontend
// (città, occupazioni, abitudini, servizi degli annunci). L'unica fonte è options.json: il server
// lo include nel binario, il frontend lo importa da src/api/options.ts.
package shared

import (
	_ "embed"
	"encoding/json"
)

//go:embed options.json
var optionsJSON []byte

// Option è un valore di un elenco chiuso: la chiave si salva nel database, l'etichetta la mostra il frontend.
type Option struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

var (
	// Cities sono le città ammesse per profili e annunci, salvate con il nome come appare qui.
	Cities        []string
	Occupations   []Option
	LifestyleTags []Option
	Amenities     []Option
)

func init() {
	var options struct {
		Cities        []string `json:"cities"`
		Occupations   []Option `json:"occupations"`
		LifestyleTags []Option `json:"lifestyleTags"`
		Amenities     []Option `json:"amenities"`
	}
	if err := json.Unmarshal(optionsJSON, &options); err != nil {
		panic("shared/options.json non valido: " + err.Error())
	}
	Cities, Occupations, LifestyleTags, Amenities = options.Cities, options.Occupations, options.LifestyleTags, options.Amenities
}

// IsCity indica se s è una delle città ammesse.
func IsCity(s string) bool {
	for _, c := range Cities {
		if c == s {
			return true
		}
	}
	return false
}

// HasKey indica se key è la chiave di una delle opzioni.
func HasKey(options []Option, key string) bool {
	for _, o := range options {
		if o.Key == key {
			return true
		}
	}
	return false
}

// NormalizeKeys elimina i duplicati e ordina le chiavi come nell'elenco delle opzioni.
// ok è false se c'è una chiave sconosciuta.
func NormalizeKeys(options []Option, keys []string) (out []string, ok bool) {
	selected := make(map[string]bool, len(keys))
	for _, k := range keys {
		selected[k] = true
	}
	out = []string{}
	for _, o := range options {
		if selected[o.Key] {
			out = append(out, o.Key)
			delete(selected, o.Key)
		}
	}
	return out, len(selected) == 0
}
