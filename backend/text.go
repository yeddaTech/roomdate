package backend

import (
	"html"

	"github.com/microcosm-cc/bluemonday"
)

// Le policy di bluemonday sono sicure da usare in parallelo.
var strictTextPolicy = bluemonday.StrictPolicy()

// sanitizeText rimuove ogni tag HTML ma conserva il testo così come l'utente l'ha scritto.
// Da solo, bluemonday restituisce testo già "escapato" per l'HTML ("un'amica" → "un&#39;amica"):
// salvato nel DB, React lo mostrerebbe letteralmente, visto che fa già l'escape in output.
func sanitizeText(s string) string {
	return html.UnescapeString(strictTextPolicy.Sanitize(s))
}
