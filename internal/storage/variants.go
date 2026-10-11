package storage

import (
	"fmt"
	"strings"
)

// VariantWidths sono le larghezze delle versioni ridotte di una foto, in pixel. Il browser le crea
// al caricamento accanto all'originale (al massimo 1600 px): le schede e le miniature scaricano la
// più piccola che basta allo schermo invece dell'originale.
var VariantWidths = []int{480, 960}

// OriginalWidth è la larghezza dichiarata dell'originale nello srcset: il lato lungo massimo con
// cui il browser salva le foto (src/api/photos.ts).
const OriginalWidth = 1600

// VariantKey è la chiave della versione larga width di una foto: "listings/7/abc.jpg" diventa
// "listings/7/abc-w480.jpg". Le versioni ridotte sono sempre JPEG.
func VariantKey(key string, width int) string {
	base := key
	if dot := strings.LastIndexByte(key, '.'); dot > strings.LastIndexByte(key, '/') {
		base = key[:dot]
	}
	return fmt.Sprintf("%s-w%d.jpg", base, width)
}

// ImageKeys sono tutte le chiavi di una foto: l'originale e le sue versioni ridotte.
func ImageKeys(key string, widths []int32) []string {
	keys := []string{key}
	for _, w := range widths {
		keys = append(keys, VariantKey(key, int(w)))
	}
	return keys
}

// Srcset è l'elenco delle versioni di una foto per l'attributo srcset di <img>, dalla più
// piccola all'originale; vuoto se la foto non ha versioni ridotte (caricata prima del modulo M2.8).
func Srcset(st Storage, key string, widths []int32) string {
	if len(widths) == 0 {
		return ""
	}
	parts := make([]string, 0, len(widths)+1)
	for _, w := range widths {
		url := st.PublicURL(VariantKey(key, int(w)))
		if url == "" {
			return ""
		}
		parts = append(parts, fmt.Sprintf("%s %dw", url, w))
	}
	parts = append(parts, fmt.Sprintf("%s %dw", st.PublicURL(key), OriginalWidth))
	return strings.Join(parts, ", ")
}
