// Package seo dà ai motori di ricerca e ai social ciò che l'app (una pagina React disegnata dal
// browser) non può dare da sola (modulo M2.8): la mappa del sito con gli annunci veri e, ai
// programmi che creano l'anteprima dei link condivisi, una pagina con titolo, prezzo e foto.
package seo

import (
	"context"
	"encoding/xml"
	"html/template"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/listings"
	"roomdate-backend/internal/logx"
)

// Listings sono gli annunci visibili a tutti.
type Listings interface {
	Sitemap(ctx context.Context) ([]listings.SitemapEntry, []listings.CityCount, error)
	Preview(ctx context.Context, rawID string) (listings.Preview, error)
}

// Handler serve la mappa del sito e le anteprime degli annunci.
type Handler struct {
	listings Listings
	// site è l'indirizzo pubblico del sito, senza "/" finale.
	site string
}

func NewHandler(l Listings, siteURL string) *Handler {
	return &Handler{listings: l, site: siteURL}
}

// Pagine fisse indicizzabili. I profili delle persone no: per scelta di riservatezza non finiscono
// nei motori di ricerca (le pagine hanno anche il meta noindex).
var staticPages = []string{"/", "/ricerca", "/guida", "/privacy", "/termini"}

type urlSet struct {
	XMLName xml.Name   `xml:"urlset"`
	Xmlns   string     `xml:"xmlns,attr"`
	URLs    []urlEntry `xml:"url"`
}

type urlEntry struct {
	Loc     string `xml:"loc"`
	LastMod string `xml:"lastmod,omitempty"`
}

// Sitemap risponde a GET /sitemap.xml: pagine fisse, ricerca per città e annunci visibili a tutti.
func (h *Handler) Sitemap(w http.ResponseWriter, r *http.Request) {
	entries, cities, err := h.listings.Sitemap(r.Context())
	if err != nil {
		logx.From(r.Context()).Error("mappa del sito", "err", err)
		http.Error(w, "Mappa del sito non disponibile", http.StatusServiceUnavailable)
		return
	}
	set := urlSet{Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9"}
	for _, path := range staticPages {
		set.URLs = append(set.URLs, urlEntry{Loc: h.site + path})
	}
	for _, c := range cities {
		set.URLs = append(set.URLs, urlEntry{Loc: h.site + "/ricerca?" + url.Values{"citta": {c.City}}.Encode()})
	}
	for _, e := range entries {
		set.URLs = append(set.URLs, urlEntry{Loc: h.site + "/dettagli/" + strconv.Itoa(e.ID), LastMod: e.UpdatedAt.UTC().Format(time.DateOnly)})
	}

	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	// Cambia di rado: la rete di Vercel la tiene un'ora
	w.Header().Set("Cache-Control", "public, max-age=600, s-maxage=3600")
	_, _ = w.Write([]byte(xml.Header))
	if err := xml.NewEncoder(w).Encode(set); err != nil {
		logx.From(r.Context()).Warn("scrittura della mappa del sito", "err", err)
	}
}

var previewPage = template.Must(template.New("preview").Parse(`<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{.Title}}</title>
<meta name="description" content="{{.Description}}">
<link rel="canonical" href="{{.URL}}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="RoomDate">
<meta property="og:locale" content="it_IT">
<meta property="og:url" content="{{.URL}}">
<meta property="og:title" content="{{.Title}}">
<meta property="og:description" content="{{.Description}}">
<meta property="og:image" content="{{.Image}}">
<meta property="og:image:alt" content="{{.ImageAlt}}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{.Title}}">
<meta name="twitter:description" content="{{.Description}}">
<meta name="twitter:image" content="{{.Image}}">
</head>
<body>
<h1>{{.Title}}</h1>
<p>{{.Description}}</p>
<p><a href="{{.URL}}">Apri su RoomDate</a></p>
</body>
</html>
`))

type previewData struct {
	Title, Description, URL, Image, ImageAlt string
}

// ListingPreview risponde a GET /dettagli/{id} per i programmi che creano l'anteprima dei link
// (vercel.json inoltra qui solo i loro user agent: le persone ricevono l'app). Annunci non visibili
// a tutti: anteprima generica del sito.
func (h *Handler) ListingPreview(w http.ResponseWriter, r *http.Request) {
	data := previewData{
		Title:       "RoomDate — Stanze in affitto e coinquilini",
		Description: "Cerca stanze in affitto e coinquilini e scrivi direttamente a chi ti interessa, in una chat cifrata.",
		URL:         h.site + "/",
		Image:       h.site + "/og-image.png",
		ImageAlt:    "RoomDate",
	}
	status := http.StatusOK
	p, err := h.listings.Preview(r.Context(), r.PathValue("id"))
	if appErr, ok := apperr.As(err); ok && appErr.Status == http.StatusNotFound {
		status = http.StatusNotFound
	} else if err != nil {
		logx.From(r.Context()).Error("anteprima annuncio", "err", err)
		status = http.StatusInternalServerError
	} else {
		data.Title = p.Title + " | RoomDate"
		data.Description = p.Facts
		if p.Text != "" {
			data.Description += ". " + p.Text
		}
		data.URL = h.site + "/dettagli/" + strconv.Itoa(p.ID)
		if p.ImageURL != "" {
			data.Image = p.ImageURL
			data.ImageAlt = "Foto della stanza: " + p.Title
		}
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	// Solo per le anteprime: niente indicizzazione e niente cache condivisa (la stessa URL per le
	// persone è l'app)
	w.Header().Set("X-Robots-Tag", "noindex")
	w.Header().Set("Cache-Control", "private, max-age=300")
	w.WriteHeader(status)
	if err := previewPage.Execute(w, data); err != nil {
		logx.From(r.Context()).Warn("scrittura anteprima", "err", err)
	}
}
