package listings

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"roomdate-backend/internal/db"
	"roomdate-backend/internal/storage"
	"roomdate-backend/internal/validate"
)

// Massimo di annunci nella mappa del sito: il protocollo ammette 50.000 indirizzi per file, il
// resto lo occupano le città e le pagine fisse.
const maxSitemapListings = 45000

// Sitemap restituisce gli annunci e le città che vede anche chi non ha fatto l'accesso, per la
// mappa del sito.
func (s *Service) Sitemap(ctx context.Context) ([]SitemapEntry, []CityCount, error) {
	entries, err := s.store.Sitemap(ctx, maxSitemapListings)
	if err != nil {
		return nil, nil, fmt.Errorf("annunci per la mappa del sito: %w", err)
	}
	cities, err := s.store.Cities(ctx, "", 500)
	if err != nil {
		return nil, nil, fmt.Errorf("città per la mappa del sito: %w", err)
	}
	return entries, cities, nil
}

// Preview è l'anteprima di un annuncio per chi ne condivide il link (WhatsApp, Telegram, social).
type Preview struct {
	ID    int
	Title string
	// Facts: "650 € al mese · Singola · Isola, Milano".
	Facts string
	// Text: l'inizio della descrizione, su una riga.
	Text string
	// ImageURL: la prima foto, nella versione da 960 px se c'è (più leggera da scaricare).
	ImageURL string
}

// Lunghezza massima del testo dell'anteprima, in caratteri.
const previewTextLength = 180

var roomTypeLabels = map[string]string{"singola": "Singola", "doppia": "Doppia"}

// Preview restituisce l'anteprima di un annuncio visibile a tutti; per gli altri, "non trovato".
func (s *Service) Preview(ctx context.Context, rawID string) (Preview, error) {
	id, ok := validate.PositiveID(rawID)
	if !ok {
		return Preview{}, errNotFound
	}
	r, err := s.store.Get(ctx, id)
	if db.IsNoRows(err) {
		return Preview{}, errNotFound
	}
	if err != nil {
		return Preview{}, fmt.Errorf("lettura annuncio: %w", err)
	}
	// Come per chi non ha fatto l'accesso: niente annunci ritirati, rimossi o di utenti sospesi
	visible, err := s.visible(ctx, "", r)
	if err != nil {
		return Preview{}, err
	}
	if !visible {
		return Preview{}, errNotFound
	}

	facts := []string{fmt.Sprintf("%d € al mese", r.Price)}
	if label := roomTypeLabels[r.RoomType]; label != "" {
		facts = append(facts, label)
	}
	place := r.City
	if r.Zone != "" {
		place = r.Zone + ", " + r.City
	}
	facts = append(facts, place)

	p := Preview{ID: r.ID, Title: r.Title, Facts: strings.Join(facts, " · "), Text: shorten(r.Description, previewTextLength)}
	if r.CoverKey != nil {
		key := *r.CoverKey
		if slices.Contains(r.CoverWidths, 960) {
			key = storage.VariantKey(key, 960)
		}
		p.ImageURL = s.storage.PublicURL(key)
	}
	return p, nil
}

// shorten mette il testo su una riga e lo taglia a max caratteri, all'ultima parola intera.
func shorten(text string, max int) string {
	text = strings.Join(strings.Fields(text), " ")
	if utf8.RuneCountInString(text) <= max {
		return text
	}
	runes := []rune(text)[:max]
	cut := string(runes)
	if i := strings.LastIndexByte(cut, ' '); i > max/2 {
		cut = cut[:i]
	}
	return strings.TrimRight(cut, " ,.;:") + "…"
}
