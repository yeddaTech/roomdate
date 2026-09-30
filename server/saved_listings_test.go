package server_test

import (
	"context"
	"net/http"
	"slices"
	"testing"
)

// Preferiti (modulo M2.4): gli annunci salvati da ogni utente.

func (a *testApp) saveListing(cookie string, id int) int {
	a.t.Helper()
	return a.do(http.MethodPut, "/api/v1/me/saved-listings/"+itoa(id), nil, withSession(cookie)).Code
}

func (a *testApp) unsaveListing(cookie string, id int) int {
	a.t.Helper()
	return a.do(http.MethodDelete, "/api/v1/me/saved-listings/"+itoa(id), nil, withSession(cookie)).Code
}

func (a *testApp) savedListings(cookie, query string) listingsPage {
	a.t.Helper()
	rec := a.do(http.MethodGet, "/api/v1/me/saved-listings"+query, nil, withSession(cookie))
	expect(a.t, rec, http.StatusOK, "")
	var page listingsPage
	decode(a.t, rec, &page)
	return page
}

func savedIDs(page listingsPage) []int {
	ids := []int{}
	for _, l := range page.Items {
		if !l.Saved {
			ids = append(ids, -l.ID) // un preferito senza saved=true fa fallire il confronto
			continue
		}
		ids = append(ids, l.ID)
	}
	return ids
}

func TestSavedListings(t *testing.T) {
	app := newApp(t)
	owner := app.registerUser("Marco", "affitta", false)
	anna := app.registerUser("Anna", "cerca", true)
	bruno := app.registerUser("Bruno", "cerca", true)
	first := app.createListing(owner.Cookie, map[string]any{"title": "Prima"})
	second := app.createListing(owner.Cookie, map[string]any{"title": "Seconda"})
	third := app.createListing(owner.Cookie, map[string]any{"title": "Terza"})

	// Salvare è idempotente; l'elenco va dal salvato più di recente
	for _, id := range []int{first, second, second} {
		if code := app.saveListing(anna.Cookie, id); code != http.StatusNoContent {
			t.Fatalf("salvataggio di %d: %d", id, code)
		}
	}
	if got := savedIDs(app.savedListings(anna.Cookie, "")); !slices.Equal(got, []int{second, first}) {
		t.Errorf("preferiti di Anna = %v, attesi %v", got, []int{second, first})
	}
	if got := app.savedListings(bruno.Cookie, "").Items; len(got) != 0 {
		t.Errorf("Bruno non ha preferiti, ne vede %d", len(got))
	}

	t.Run("l'elenco pubblico e il dettaglio dicono cosa ho salvato", func(t *testing.T) {
		rec := app.do(http.MethodGet, "/api/v1/listings", nil, withSession(anna.Cookie))
		var page listingsPage
		decode(t, rec, &page)
		saved := map[int]bool{}
		for _, l := range page.Items {
			saved[l.ID] = l.Saved
		}
		if !saved[first] || !saved[second] || saved[third] {
			t.Errorf("elenco visto da Anna: %v", saved)
		}
		for _, l := range app.listings("").Items {
			if l.Saved {
				t.Errorf("senza sessione nessun annuncio risulta salvato: %d", l.ID)
			}
		}
		if detail, _ := app.listing(first, anna.Cookie); !detail.Saved {
			t.Error("dettaglio visto da Anna: saved=false")
		}
		if detail, _ := app.listing(first, bruno.Cookie); detail.Saved {
			t.Error("dettaglio visto da Bruno: saved=true")
		}
	})

	t.Run("togliere è idempotente", func(t *testing.T) {
		if app.unsaveListing(anna.Cookie, first) != http.StatusNoContent || app.unsaveListing(anna.Cookie, first) != http.StatusNoContent {
			t.Fatal("rimozione del preferito non riuscita")
		}
		if got := savedIDs(app.savedListings(anna.Cookie, "")); !slices.Equal(got, []int{second}) {
			t.Errorf("dopo la rimozione: %v", got)
		}
		// Anche un annuncio che non esiste: non c'è nulla da togliere
		if code := app.unsaveListing(anna.Cookie, 99999); code != http.StatusNoContent {
			t.Errorf("rimozione di un annuncio inesistente: %d", code)
		}
	})

	t.Run("annunci inesistenti o non visibili non si salvano", func(t *testing.T) {
		expect(t, app.do(http.MethodPut, "/api/v1/me/saved-listings/99999", nil, withSession(anna.Cookie)), http.StatusNotFound, "listing_not_found")
		expect(t, app.do(http.MethodPut, "/api/v1/me/saved-listings/abc", nil, withSession(anna.Cookie)), http.StatusNotFound, "")
		expect(t, app.do(http.MethodPut, "/api/v1/listings/"+itoa(third)+"/active", map[string]bool{"active": false}, withSession(owner.Cookie)), http.StatusNoContent, "")
		if code := app.saveListing(bruno.Cookie, third); code != http.StatusNotFound {
			t.Errorf("salvataggio di un annuncio disattivato: %d", code)
		}
		// Il proprietario lo vede ancora e può salvarlo
		if code := app.saveListing(owner.Cookie, third); code != http.StatusNoContent {
			t.Errorf("il proprietario salva il suo annuncio disattivato: %d", code)
		}
		expect(t, app.do(http.MethodPut, "/api/v1/listings/"+itoa(third)+"/active", map[string]bool{"active": true}, withSession(owner.Cookie)), http.StatusNoContent, "")
	})

	t.Run("un preferito non più visibile sparisce dall'elenco e torna con l'annuncio", func(t *testing.T) {
		expect(t, app.do(http.MethodPut, "/api/v1/listings/"+itoa(second)+"/active", map[string]bool{"active": false}, withSession(owner.Cookie)), http.StatusNoContent, "")
		if got := app.savedListings(anna.Cookie, "").Items; len(got) != 0 {
			t.Errorf("annuncio disattivato ancora nei preferiti: %v", got)
		}
		expect(t, app.do(http.MethodPut, "/api/v1/listings/"+itoa(second)+"/active", map[string]bool{"active": true}, withSession(owner.Cookie)), http.StatusNoContent, "")
		if got := savedIDs(app.savedListings(anna.Cookie, "")); !slices.Equal(got, []int{second}) {
			t.Errorf("riattivato, torna nei preferiti: %v", got)
		}
		// Blocco (in un senso o nell'altro) e sospensione del proprietario lo nascondono
		expect(t, app.block(anna.Cookie, owner.ID), http.StatusNoContent, "")
		if got := app.savedListings(anna.Cookie, "").Items; len(got) != 0 {
			t.Errorf("proprietario bloccato: il preferito resta visibile %v", got)
		}
		expect(t, app.do(http.MethodDelete, "/api/v1/me/blocks/"+owner.ID, nil, withSession(anna.Cookie)), http.StatusNoContent, "")
		testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET suspended_at = now() WHERE id = $1`, owner.ID)
		if got := app.savedListings(anna.Cookie, "").Items; len(got) != 0 {
			t.Errorf("proprietario sospeso: il preferito resta visibile %v", got)
		}
		testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET suspended_at = NULL WHERE id = $1`, owner.ID)
		testPool.Exec(context.Background(), `UPDATE roomdate_app.listings SET removed_at = now() WHERE id = $1`, second)
		if got := app.savedListings(anna.Cookie, "").Items; len(got) != 0 {
			t.Errorf("annuncio rimosso dalla moderazione: il preferito resta visibile %v", got)
		}
		testPool.Exec(context.Background(), `UPDATE roomdate_app.listings SET removed_at = NULL WHERE id = $1`, second)
	})

	t.Run("a pagine, senza ripetizioni", func(t *testing.T) {
		for _, id := range []int{first, third} {
			app.saveListing(anna.Cookie, id)
		}
		page1 := app.savedListings(anna.Cookie, "?limit=2")
		if page1.NextCursor == nil || len(page1.Items) != 2 {
			t.Fatalf("prima pagina: %d annunci, cursore %v", len(page1.Items), page1.NextCursor)
		}
		page2 := app.savedListings(anna.Cookie, "?limit=2&cursor="+*page1.NextCursor)
		all := append(savedIDs(page1), savedIDs(page2)...)
		if page2.NextCursor != nil || !slices.Equal(all, []int{third, first, second}) {
			t.Errorf("pagine: %v (cursore finale %v)", all, page2.NextCursor)
		}
		expect(t, app.do(http.MethodGet, "/api/v1/me/saved-listings?cursor=rotto", nil, withSession(anna.Cookie)), http.StatusBadRequest, "cursor")
		expect(t, app.do(http.MethodGet, "/api/v1/me/saved-listings?limit=0", nil, withSession(anna.Cookie)), http.StatusBadRequest, "limit")
	})

	t.Run("eliminando l'annuncio spariscono anche i preferiti", func(t *testing.T) {
		expect(t, app.do(http.MethodDelete, "/api/v1/listings/"+itoa(first), nil, withSession(owner.Cookie)), http.StatusNoContent, "")
		var n int
		testPool.QueryRow(context.Background(), `SELECT count(*) FROM roomdate_app.saved_listings WHERE listing_id = $1`, first).Scan(&n)
		if n != 0 {
			t.Errorf("preferiti di un annuncio eliminato: %d", n)
		}
	})
}

// La home mostra solo città con annunci che chi guarda può vedere, dalla più ricca.
func TestListingCities(t *testing.T) {
	app := newApp(t)
	expect(t, app.do(http.MethodGet, "/api/v1/listings/cities", nil), http.StatusOK, `{"items":[]}`)

	owner := app.registerUser("Marco", "affitta", false)
	other := app.registerUser("Luca", "affitta", false)
	anna := app.registerUser("Anna", "cerca", true)
	for _, city := range []string{"Milano", "Milano", "Roma"} {
		app.createListing(owner.Cookie, map[string]any{"city": city})
	}
	hidden := app.createListing(owner.Cookie, map[string]any{"city": "Torino"})
	expect(t, app.do(http.MethodPut, "/api/v1/listings/"+itoa(hidden)+"/active", map[string]bool{"active": false}, withSession(owner.Cookie)), http.StatusNoContent, "")
	app.createListing(other.Cookie, map[string]any{"city": "Bologna"})

	expect(t, app.do(http.MethodGet, "/api/v1/listings/cities", nil), http.StatusOK,
		`{"items":[{"city":"Milano","count":2},{"city":"Bologna","count":1},{"city":"Roma","count":1}]}`)
	// Chi ha bloccato Luca non vede Bologna
	expect(t, app.block(anna.Cookie, other.ID), http.StatusNoContent, "")
	expect(t, app.do(http.MethodGet, "/api/v1/listings/cities", nil, withSession(anna.Cookie)), http.StatusOK,
		`{"items":[{"city":"Milano","count":2},{"city":"Roma","count":1}]}`)
}
