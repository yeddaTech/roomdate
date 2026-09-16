package server_test

import (
	"context"
	"net/http"
	"testing"
)

func validListing() map[string]any {
	return map[string]any{
		"title": "Singola in zona Isola", "city": "Milano", "zone": "Isola",
		"roomType": "singola", "price": 650, "description": "Stanza luminosa vicino alla M5",
	}
}

func listingWith(fields map[string]any) map[string]any {
	body := validListing()
	for k, v := range fields {
		body[k] = v
	}
	return body
}

func TestCreateListing(t *testing.T) {
	app := newApp(t)
	landlord := app.registerUser("Marco", "affitta", false)
	seeker := app.registerUser("Giulia", "cerca", false)

	expect(t, app.do(http.MethodPost, "/api/create_listing", validListing()), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodPost, "/api/create_listing", validListing(), withSession(seeker.Cookie)), http.StatusForbidden, "Solo i proprietari")

	cases := map[string]map[string]any{
		"Il titolo è obbligatorio":       {"title": "  "},
		"Tipo di stanza non valido":      {"roomType": "suite"},
		"Il prezzo deve essere compreso": {"price": 0},
		"La descrizione è obbligatoria":  {"description": ""},
	}
	for message, fields := range cases {
		expect(t, app.do(http.MethodPost, "/api/create_listing", listingWith(fields), withSession(landlord.Cookie)), http.StatusBadRequest, message)
	}

	body := listingWith(map[string]any{
		"title":       "Stanza all'ultimo piano & terrazzo<script>alert(1)</script>",
		"description": "Vicino all'M2 <img src=x onerror=alert(1)>",
	})
	expect(t, app.do(http.MethodPost, "/api/create_listing", body, withSession(landlord.Cookie)), http.StatusCreated, "Annuncio pubblicato")

	var title, description string
	testPool.QueryRow(context.Background(), `SELECT title, description FROM roomdate_app.listings`).Scan(&title, &description)
	if title != "Stanza all'ultimo piano & terrazzo" || description != "Vicino all'M2" {
		t.Fatalf("salvati: %q, %q", title, description)
	}
}

func TestReadListings(t *testing.T) {
	app := newApp(t)
	landlord := app.registerUser("Marco", "affitta", false)
	expect(t, app.do(http.MethodPost, "/api/create_listing", validListing(), withSession(landlord.Cookie)), http.StatusCreated, "")

	rec := app.do(http.MethodGet, "/api/get_listings", nil)
	expect(t, rec, http.StatusOK, "")
	var list []map[string]any
	decode(t, rec, &list)
	if len(list) != 1 || list[0]["title"] != "Singola in zona Isola" || list[0]["price"] != float64(650) {
		t.Fatalf("elenco = %s", rec.Body.String())
	}
	id := int(list[0]["id"].(float64))

	rec = app.do(http.MethodGet, "/api/get_listing?id="+itoa(id), nil)
	expect(t, rec, http.StatusOK, `"type":"singola"`)
	var detail struct {
		Landlord struct{ Name string }
		Images   []string
	}
	decode(t, rec, &detail)
	if detail.Landlord.Name != "Marco" {
		t.Errorf("proprietario = %q", detail.Landlord.Name)
	}

	expect(t, app.do(http.MethodGet, "/api/get_listing", nil), http.StatusBadRequest, "ID mancante")
	expect(t, app.do(http.MethodGet, "/api/get_listing?id=abc", nil), http.StatusBadRequest, "ID annuncio non valido")
	expect(t, app.do(http.MethodGet, "/api/get_listing?id=99999", nil), http.StatusNotFound, "")

	expect(t, app.do(http.MethodGet, "/api/get_my_listings", nil), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodGet, "/api/get_my_listings", nil, withSession(landlord.Cookie)), http.StatusOK, `"roomType":"singola"`)
}

func TestEmptyListsAreArrays(t *testing.T) {
	app := newApp(t)
	seeker := app.registerUser("Giulia", "cerca", false)

	expect(t, app.do(http.MethodGet, "/api/get_listings", nil), http.StatusOK, "[]")
	expect(t, app.do(http.MethodGet, "/api/get_my_listings", nil, withSession(seeker.Cookie)), http.StatusOK, "[]")
	expect(t, app.do(http.MethodGet, "/api/get_chats", nil, withSession(seeker.Cookie)), http.StatusOK, "[]")
}

func TestDeleteListing(t *testing.T) {
	app := newApp(t)
	owner := app.registerUser("Marco", "affitta", false)
	otherLandlord := app.registerUser("Luca", "affitta", false)
	seeker := app.registerUser("Giulia", "cerca", false)
	expect(t, app.do(http.MethodPost, "/api/create_listing", validListing(), withSession(owner.Cookie)), http.StatusCreated, "")

	expect(t, app.do(http.MethodDelete, "/api/delete_listing?id=1", nil), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodDelete, "/api/delete_listing?id=1", nil, withSession(seeker.Cookie)), http.StatusForbidden, "Solo i proprietari")
	expect(t, app.do(http.MethodDelete, "/api/delete_listing", nil, withSession(owner.Cookie)), http.StatusBadRequest, "ID annuncio mancante")
	expect(t, app.do(http.MethodDelete, "/api/delete_listing?id=x", nil, withSession(owner.Cookie)), http.StatusBadRequest, "ID annuncio non valido")
	expect(t, app.do(http.MethodDelete, "/api/delete_listing?id=1", nil, withSession(otherLandlord.Cookie)), http.StatusForbidden, "non autorizzato")

	// Con una conversazione collegata il vincolo di chiave esterna blocca l'eliminazione: errore generico
	expect(t, app.do(http.MethodPost, "/api/start_chat", map[string]int{"listingId": 1}, withSession(seeker.Cookie)), http.StatusOK, "")
	rec := app.do(http.MethodDelete, "/api/delete_listing?id=1", nil, withSession(owner.Cookie))
	expect(t, rec, http.StatusInternalServerError, "Impossibile eliminare l'annuncio")
	expectNoLeak(t, rec)

	testPool.Exec(context.Background(), `DELETE FROM roomdate_app.conversations`)
	expect(t, app.do(http.MethodDelete, "/api/delete_listing?id=1", nil, withSession(owner.Cookie)), http.StatusOK, "Annuncio eliminato")
}
