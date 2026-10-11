package server_test

import (
	"context"
	"encoding/xml"
	"net/http"
	"strings"
	"testing"

	"roomdate-backend/internal/config"
)

// sitemapLocs legge la mappa del sito e restituisce gli indirizzi con la data di aggiornamento.
func sitemapLocs(t *testing.T, app *testApp) map[string]string {
	t.Helper()
	rec := app.do(http.MethodGet, "/sitemap.xml", nil)
	expect(t, rec, http.StatusOK, "")
	if ct := rec.Header().Get("Content-Type"); ct != "application/xml; charset=utf-8" {
		t.Errorf("Content-Type = %q", ct)
	}
	var set struct {
		XMLName xml.Name `xml:"urlset"`
		Xmlns   string   `xml:"xmlns,attr"`
		URLs    []struct {
			Loc     string `xml:"loc"`
			LastMod string `xml:"lastmod"`
		} `xml:"url"`
	}
	if err := xml.Unmarshal(rec.Body.Bytes(), &set); err != nil {
		t.Fatalf("XML non valido: %v\n%s", err, rec.Body.String())
	}
	if set.Xmlns != "http://www.sitemaps.org/schemas/sitemap/0.9" {
		t.Errorf("xmlns = %q", set.Xmlns)
	}
	locs := map[string]string{}
	for _, u := range set.URLs {
		locs[u.Loc] = u.LastMod
	}
	return locs
}

func TestSitemap(t *testing.T) {
	app := newApp(t)
	marco := app.registerUser("Marco", "affitta", false)
	luca := app.registerUser("Luca", "affitta", false)
	milano := app.createListing(marco.Cookie, nil)
	reggio := app.createListing(marco.Cookie, map[string]any{"city": "Reggio Emilia", "zone": ""})
	aquila := app.createListing(marco.Cookie, map[string]any{"city": "L'Aquila", "zone": ""})
	withdrawn := app.createListing(marco.Cookie, map[string]any{"city": "Torino"})
	expect(t, app.do(http.MethodPut, "/api/v1/listings/"+itoa(withdrawn)+"/active", map[string]bool{"active": false}, withSession(marco.Cookie)), http.StatusNoContent, "")
	removed := app.createListing(marco.Cookie, map[string]any{"city": "Bari"})
	suspended := app.createListing(luca.Cookie, map[string]any{"city": "Napoli"})
	ctx := context.Background()
	if _, err := testPool.Exec(ctx, `UPDATE roomdate_app.listings SET removed_at = now() WHERE id = $1`, removed); err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, `UPDATE roomdate_app.users SET suspended_at = now() WHERE id = $1`, luca.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, `UPDATE roomdate_app.listings SET updated_at = '2026-09-15 23:30:00+00' WHERE id = $1`, milano); err != nil {
		t.Fatal(err)
	}

	locs := sitemapLocs(t, app)
	site := config.DefaultSiteURL
	for _, path := range []string{"/", "/ricerca", "/guida", "/privacy", "/termini",
		"/ricerca?citta=Milano", "/ricerca?citta=Reggio+Emilia", "/ricerca?citta=L%27Aquila",
		"/dettagli/" + itoa(milano), "/dettagli/" + itoa(reggio), "/dettagli/" + itoa(aquila)} {
		if _, ok := locs[site+path]; !ok {
			t.Errorf("manca %s", path)
		}
	}
	for _, id := range []int{withdrawn, removed, suspended} {
		if _, ok := locs[site+"/dettagli/"+itoa(id)]; ok {
			t.Errorf("l'annuncio %d non è visibile a tutti e non va nella mappa", id)
		}
	}
	for _, city := range []string{"Torino", "Bari", "Napoli"} {
		if _, ok := locs[site+"/ricerca?citta="+city]; ok {
			t.Errorf("%s non ha annunci visibili", city)
		}
	}
	if got := locs[site+"/dettagli/"+itoa(milano)]; got != "2026-09-15" {
		t.Errorf("lastmod = %q, atteso 2026-09-15 (in UTC)", got)
	}
	for loc := range locs {
		if strings.Contains(loc, "/coinquilino/") {
			t.Errorf("i profili delle persone non vanno nella mappa: %s", loc)
		}
	}

	rec := app.do(http.MethodGet, "/sitemap.xml", nil)
	if cc := rec.Header().Get("Cache-Control"); !strings.HasPrefix(cc, "public") {
		t.Errorf("Cache-Control = %q", cc)
	}
	head := app.do(http.MethodHead, "/sitemap.xml", nil)
	expect(t, head, http.StatusOK, "")
	expect(t, app.do(http.MethodPost, "/sitemap.xml", nil), http.StatusMethodNotAllowed, "")

	t.Run("indirizzo del sito dalla configurazione", func(t *testing.T) {
		other := newAppWithConfig(t, newFakeStorage(), config.Config{SecretKey: "segreto-di-test", SecureCookies: true, Pusher: testPusher, SiteURL: "https://www.roomdate.example"})
		for loc := range sitemapLocs(t, other) {
			if !strings.HasPrefix(loc, "https://www.roomdate.example/") {
				t.Errorf("indirizzo %s", loc)
			}
		}
	})
}

func TestListingPreview(t *testing.T) {
	app := newApp(t)
	marco := app.registerUser("Marco", "affitta", false)
	long := strings.Repeat("Stanza luminosa con balcone e armadio grande, vicino alla metro. ", 6)
	id := app.createListing(marco.Cookie, map[string]any{"title": `Singola "Isola" <b>&</b> co`, "description": long})
	site := config.DefaultSiteURL

	t.Run("titolo, prezzo, luogo e testo, con i caratteri speciali protetti", func(t *testing.T) {
		rec := app.do(http.MethodGet, "/dettagli/"+itoa(id), nil, withHeader("User-Agent", "WhatsApp/2.24.1 A"))
		expect(t, rec, http.StatusOK, "")
		body := rec.Body.String()
		for _, want := range []string{
			`<meta property="og:title" content="Singola &#34;Isola&#34; &lt;b&gt;&amp;&lt;/b&gt; co | RoomDate">`,
			`<meta property="og:url" content="` + site + `/dettagli/` + itoa(id) + `">`,
			`<link rel="canonical" href="` + site + `/dettagli/` + itoa(id) + `">`,
			`650 € al mese · Singola · Isola, Milano. Stanza luminosa con balcone`,
			`<meta property="og:image" content="` + site + `/og-image.png">`,
			`<meta name="twitter:card" content="summary_large_image">`,
		} {
			if !strings.Contains(body, want) {
				t.Errorf("manca %s\n%s", want, body)
			}
		}
		if strings.Contains(body, "<b>&</b>") {
			t.Error("il titolo non è protetto")
		}
		description := between(body, `<meta name="description" content="`, `">`)
		if !strings.HasSuffix(description, "…") || len([]rune(description)) > 250 {
			t.Errorf("descrizione non accorciata: %q", description)
		}
		if rec.Header().Get("X-Robots-Tag") != "noindex" || !strings.HasPrefix(rec.Header().Get("Content-Type"), "text/html") ||
			!strings.HasPrefix(rec.Header().Get("Cache-Control"), "private") {
			t.Errorf("header %v", rec.Header())
		}
	})

	t.Run("con la foto: la versione da 960 px", func(t *testing.T) {
		up, _, _ := app.prepareUpload(marco.Cookie, id, "image/jpeg")
		app.storage.put(up.Key, jpegBytes(300))
		app.storage.put(up.Variants[0].Key, jpegBytes(100))
		app.storage.put(up.Variants[1].Key, jpegBytes(200))
		expect(t, app.confirmUpload(marco.Cookie, id, up.Key), http.StatusCreated, "")
		body := app.do(http.MethodGet, "/dettagli/"+itoa(id), nil).Body.String()
		image := between(body, `<meta property="og:image" content="`, `">`)
		if !strings.HasPrefix(image, "https://img.test/listings/") || !strings.HasSuffix(image, "-w960.jpg") {
			t.Errorf("og:image = %q", image)
		}
		if !strings.Contains(body, `content="Foto della stanza: Singola`) {
			t.Error("manca il testo alternativo della foto")
		}
	})

	t.Run("annunci non visibili a tutti: anteprima generica", func(t *testing.T) {
		hidden := app.createListing(marco.Cookie, map[string]any{"title": "Annuncio ritirato"})
		expect(t, app.do(http.MethodPut, "/api/v1/listings/"+itoa(hidden)+"/active", map[string]bool{"active": false}, withSession(marco.Cookie)), http.StatusNoContent, "")
		for _, path := range []string{"/dettagli/" + itoa(hidden), "/dettagli/999999", "/dettagli/abc"} {
			rec := app.do(http.MethodGet, path, nil)
			expect(t, rec, http.StatusNotFound, `<meta property="og:url" content="`+site+`/">`)
			if strings.Contains(rec.Body.String(), "Annuncio ritirato") {
				t.Errorf("%s: l'anteprima mostra un annuncio ritirato", path)
			}
		}
	})

	t.Run("HEAD", func(t *testing.T) {
		expect(t, app.do(http.MethodHead, "/dettagli/"+itoa(id), nil), http.StatusOK, "")
	})
}

func between(s, start, end string) string {
	i := strings.Index(s, start)
	if i < 0 {
		return ""
	}
	rest := s[i+len(start):]
	if j := strings.Index(rest, end); j >= 0 {
		return rest[:j]
	}
	return rest
}
