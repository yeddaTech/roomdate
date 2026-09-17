package server_test

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"testing"
)

// searchFixture pubblica annunci con prezzi, città e caratteristiche diverse.
type searchFixture struct {
	app *testApp
	ids map[string]int
}

func newSearchFixture(t *testing.T) searchFixture {
	app := newApp(t)
	landlord := app.registerUser("Marco", "affitta", false)
	f := searchFixture{app: app, ids: map[string]int{}}
	listings := []struct {
		name, city, roomType string
		price                int
		bills                bool
	}{
		{"milano-economica", "Milano", "doppia", 400, false},
		{"milano-media", "Milano", "singola", 650, true},
		{"milano-cara", "Milano", "singola", 900, false},
		{"roma-media", "Roma", "singola", 650, true},
		{"torino-economica", "Torino", "doppia", 300, true},
	}
	for _, l := range listings {
		f.ids[l.name] = app.createListing(landlord.Cookie, map[string]any{
			"title": l.name, "city": l.city, "roomType": l.roomType, "price": l.price, "billsIncluded": l.bills,
		})
	}
	return f
}

// titles restituisce i titoli degli annunci di una pagina, nell'ordine ricevuto.
func titles(page listingsPage) []string {
	out := []string{}
	for _, l := range page.Items {
		out = append(out, l.Title)
	}
	return out
}

// Anomalia F17: i filtri lavorano sul database, non nel browser su un elenco parziale.
func TestSearchFilters(t *testing.T) {
	f := newSearchFixture(t)
	cases := []struct {
		query string
		want  []string
	}{
		{"", []string{"torino-economica", "roma-media", "milano-cara", "milano-media", "milano-economica"}},
		{"?city=Milano", []string{"milano-cara", "milano-media", "milano-economica"}},
		{"?city=Roma", []string{"roma-media"}},
		{"?maxPrice=650", []string{"torino-economica", "roma-media", "milano-media", "milano-economica"}},
		{"?roomType=doppia", []string{"torino-economica", "milano-economica"}},
		{"?billsIncluded=true", []string{"torino-economica", "roma-media", "milano-media"}},
		{"?billsIncluded=false", []string{"milano-cara", "milano-economica"}},
		{"?city=Milano&maxPrice=650&roomType=singola", []string{"milano-media"}},
		{"?city=Milano&maxPrice=100", []string{}},
	}
	for _, c := range cases {
		t.Run("filtri "+c.query, func(t *testing.T) {
			if got := titles(f.app.listings(c.query)); !slices.Equal(got, c.want) {
				t.Errorf("elenco = %v, atteso %v", got, c.want)
			}
		})
	}

	t.Run("gli annunci disattivati non compaiono", func(t *testing.T) {
		_, err := testPool.Exec(context.Background(), `UPDATE roomdate_app.listings SET is_active = false WHERE title = 'milano-media'`)
		if err != nil {
			t.Fatal(err)
		}
		if got := titles(f.app.listings("?city=Milano")); !slices.Equal(got, []string{"milano-cara", "milano-economica"}) {
			t.Errorf("elenco = %v", got)
		}
	})
}

func TestSearchSorting(t *testing.T) {
	f := newSearchFixture(t)
	// L'ordine per data non dipende dagli ID: qui il più vecchio è l'ultimo pubblicato
	_, err := testPool.Exec(context.Background(),
		`UPDATE roomdate_app.listings SET created_at = NOW() - make_interval(days => 10) WHERE title = 'torino-economica'`)
	if err != nil {
		t.Fatal(err)
	}

	cases := map[string][]string{
		"?sort=recenti":     {"roma-media", "milano-cara", "milano-media", "milano-economica", "torino-economica"},
		"?sort=prezzo":      {"torino-economica", "milano-economica", "milano-media", "roma-media", "milano-cara"},
		"?sort=prezzo-desc": {"milano-cara", "roma-media", "milano-media", "milano-economica", "torino-economica"},
	}
	for query, want := range cases {
		if got := titles(f.app.listings(query)); !slices.Equal(got, want) {
			t.Errorf("%s = %v, atteso %v", query, got, want)
		}
	}

	// A parità di prezzo l'ordine resta stabile tra le due direzioni (roma-media e milano-media)
	asc := titles(f.app.listings("?sort=prezzo&maxPrice=650"))
	desc := titles(f.app.listings("?sort=prezzo-desc&maxPrice=650"))
	slices.Reverse(desc)
	if !slices.Equal(asc, desc) {
		t.Errorf("ordine instabile: %v e %v", asc, desc)
	}
}

// Scorrendo le pagine ogni annuncio compare una sola volta, con qualsiasi ordinamento,
// anche quando le date di creazione sono uguali o mancanti.
func TestSearchPagination(t *testing.T) {
	app := newApp(t)
	landlord := app.registerUser("Marco", "affitta", false)
	for i := 1; i <= 7; i++ {
		app.createListing(landlord.Cookie, map[string]any{"title": fmt.Sprintf("stanza-%d", i), "price": 300 + 100*(i%3)})
	}
	ctx := context.Background()
	for _, query := range []string{
		`UPDATE roomdate_app.listings SET created_at = '2026-01-01 10:00:00' WHERE title IN ('stanza-1', 'stanza-2')`,
		`UPDATE roomdate_app.listings SET created_at = NULL WHERE title IN ('stanza-6', 'stanza-7')`,
	} {
		if _, err := testPool.Exec(ctx, query); err != nil {
			t.Fatal(err)
		}
	}

	for _, sort := range []string{"recenti", "prezzo", "prezzo-desc"} {
		all := titles(app.listings("?sort=" + sort + "&limit=50"))
		if len(all) != 7 {
			t.Fatalf("%s: elenco completo = %v", sort, all)
		}
		// Con 7 annunci: pagine attese per ogni dimensione, senza una pagina vuota in fondo
		for limit, wantPages := range map[string]int{"1": 7, "2": 4, "3": 3, "7": 1} {
			var seen []string
			query := fmt.Sprintf("?sort=%s&limit=%s", sort, limit)
			pages := 0
			for {
				pages++
				if pages > 10 {
					t.Fatalf("%s con limit=%s: la paginazione non termina", sort, limit)
				}
				page := app.listings(query)
				seen = append(seen, titles(page)...)
				if page.NextCursor == nil {
					break
				}
				query = fmt.Sprintf("?sort=%s&limit=%s&cursor=%s", sort, limit, url.QueryEscape(*page.NextCursor))
			}
			if !slices.Equal(seen, all) || pages != wantPages {
				t.Errorf("%s con limit=%s: %d pagine (attese %d), visti %v, attesi %v", sort, limit, pages, wantPages, seen, all)
			}
		}
	}

	// Un cursore di un ordinamento non vale per un altro
	page := app.listings("?sort=prezzo&limit=2")
	rec := app.do(http.MethodGet, "/api/v1/listings?sort=recenti&limit=2&cursor="+url.QueryEscape(*page.NextCursor), nil)
	expect(t, rec, http.StatusBadRequest, `"field":"cursor"`)
}

func TestSearchInvalidParameters(t *testing.T) {
	app := newApp(t)
	for query, field := range map[string]string{
		"?city=Gotham": "city", "?city=milano": "city",
		"?maxPrice=0": "maxPrice", "?maxPrice=20001": "maxPrice", "?maxPrice=tanto": "maxPrice",
		"?roomType=suite": "roomType", "?billsIncluded=forse": "billsIncluded",
		"?sort=prezzo-asc": "sort", "?limit=0": "limit", "?limit=51": "limit",
		"?cursor=abc": "cursor", "?cursor=" + url.QueryEscape("MTIzfCc7IERST1AgVEFCTEU"): "cursor",
	} {
		rec := app.do(http.MethodGet, "/api/v1/listings"+query, nil)
		expect(t, rec, http.StatusBadRequest, `"field":"`+field+`"`)
		expectNoLeak(t, rec)
	}
}

// Il filtro per budget dei coinquilini tiene chi può spendere almeno la cifra indicata.
func TestRoommatesBudgetFilter(t *testing.T) {
	app := newApp(t)
	anna := app.registerUser("Anna", "cerca", false)
	bruno := app.registerUser("Bruno", "cerca", false)
	setProfile(t, anna.ID, "Milano", 700)
	setProfile(t, bruno.ID, "Milano", 400)

	names := func(query string) []string {
		out := []string{}
		for _, item := range app.roommates(query, "").Items {
			out = append(out, item.FirstName)
		}
		return out
	}
	if got := names("?minBudget=500"); !slices.Equal(got, []string{"Anna"}) {
		t.Errorf("minBudget=500 = %v", got)
	}
	if got := names("?minBudget=400"); !slices.Equal(got, []string{"Bruno", "Anna"}) {
		t.Errorf("minBudget=400 = %v", got)
	}
	expect(t, app.do(http.MethodGet, "/api/v1/roommates?minBudget=0", nil), http.StatusBadRequest, `"field":"minBudget"`)
}

// Gli indici coprono filtri e ordinamenti degli elenchi: il database non deve ordinare i risultati.
func TestSearchIndexesMatchOrdering(t *testing.T) {
	app := newApp(t)
	landlord := app.registerUser("Marco", "affitta", false)
	ctx := context.Background()
	// Righe sufficienti perché ordinare senza indice costi più che leggerlo già ordinato
	_, err := testPool.Exec(ctx, `
        INSERT INTO roomdate_app.listings (user_id, title, city, room_type, price, is_active, created_at)
        SELECT $1, 'stanza ' || n, CASE WHEN n % 2 = 0 THEN 'Milano' ELSE 'Roma' END,
               'singola', 300 + n % 500, true,
               CASE WHEN n % 50 = 0 THEN NULL ELSE NOW() - make_interval(mins => n) END
        FROM generate_series(1, 4000) n`, landlord.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, `ANALYZE roomdate_app.listings`); err != nil {
		t.Fatal(err)
	}

	cases := []struct{ name, query, index string }{
		{"elenco per data", `SELECT id FROM roomdate_app.listings WHERE is_active
             ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 25`, "listings_active_recent_idx"},
		{"elenco per città", `SELECT id FROM roomdate_app.listings WHERE is_active AND city = 'Milano'
             ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 25`, "listings_active_city_recent_idx"},
		{"elenco per prezzo", `SELECT id FROM roomdate_app.listings WHERE is_active
             ORDER BY price ASC, id ASC LIMIT 25`, "listings_active_price_idx"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var plan strings.Builder
			rows, err := testPool.Query(ctx, "EXPLAIN "+c.query)
			if err != nil {
				t.Fatal(err)
			}
			for rows.Next() {
				var line string
				rows.Scan(&line)
				plan.WriteString(line + "\n")
			}
			rows.Close()
			if strings.Contains(plan.String(), "Sort") || !strings.Contains(plan.String(), c.index) {
				t.Errorf("il piano non usa %s per filtrare e ordinare:\n%s", c.index, plan.String())
			}
		})
	}
}
