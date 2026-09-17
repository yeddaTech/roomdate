package server_test

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"roomdate-backend/internal/storage"
)

func validListing() map[string]any {
	return map[string]any{
		"title": "Singola in zona Isola", "city": "Milano", "zone": "Isola",
		"roomType": "singola", "price": 650, "description": "Stanza luminosa vicino alla M5",
		"amenities": []string{"lavatrice", "wifi"}, "billsIncluded": true, "availableFrom": "",
	}
}

func listingWith(fields map[string]any) map[string]any {
	body := validListing()
	for k, v := range fields {
		body[k] = v
	}
	return body
}

type listingDetail struct {
	ID            int
	Title         string
	City          string
	Zone          string
	RoomType      string
	Price         int
	Description   string
	Amenities     []string
	BillsIncluded *bool
	AvailableFrom *string
	IsActive      bool
	CoverURL      *string
	Images        []struct {
		ID  int
		URL string
	}
	Owner   struct{ FirstName string }
	IsOwner bool
}

// createListing pubblica un annuncio valido e ne restituisce l'ID.
func (a *testApp) createListing(cookie string, fields map[string]any) int {
	a.t.Helper()
	rec := a.do(http.MethodPost, "/api/v1/listings", listingWith(fields), withSession(cookie))
	expect(a.t, rec, http.StatusCreated, "")
	var detail listingDetail
	decode(a.t, rec, &detail)
	return detail.ID
}

func (a *testApp) listing(id int, cookie string) (*listingDetail, int) {
	a.t.Helper()
	rec := a.do(http.MethodGet, "/api/v1/listings/"+itoa(id), nil, withSession(cookie))
	if rec.Code != http.StatusOK {
		return nil, rec.Code
	}
	var detail listingDetail
	decode(a.t, rec, &detail)
	return &detail, rec.Code
}

func (a *testApp) publicListingIDs() []int {
	a.t.Helper()
	rec := a.do(http.MethodGet, "/api/v1/listings", nil)
	expect(a.t, rec, http.StatusOK, "")
	var list []listingDetail
	decode(a.t, rec, &list)
	ids := []int{}
	for _, l := range list {
		ids = append(ids, l.ID)
	}
	return ids
}

func TestCreateListing(t *testing.T) {
	app := newApp(t)
	landlord := app.registerUser("Marco", "affitta", false)
	seeker := app.registerUser("Giulia", "cerca", false)

	expect(t, app.do(http.MethodPost, "/api/v1/listings", validListing()), http.StatusUnauthorized, "session_invalid")
	expect(t, app.do(http.MethodPost, "/api/v1/listings", validListing(), withSession(seeker.Cookie)), http.StatusForbidden, "landlord_only")

	nextYear := time.Now().AddDate(1, 0, 0).Format(time.DateOnly)
	tooFar := time.Now().AddDate(3, 0, 0).Format(time.DateOnly)
	cases := []struct {
		field string
		value any
	}{
		{"title", "  "},
		{"title", strings.Repeat("a", 101)},
		{"city", "Gotham"},
		{"city", "milano"},
		{"roomType", "suite"},
		{"price", 0},
		{"price", 20001},
		{"description", ""},
		{"amenities", []string{"wifi", "piscina"}},
		{"billsIncluded", nil},
		{"availableFrom", tooFar},
		{"availableFrom", "01/10/2026"},
	}
	for _, c := range cases {
		rec := app.do(http.MethodPost, "/api/v1/listings", listingWith(map[string]any{c.field: c.value}), withSession(landlord.Cookie))
		expect(t, rec, http.StatusBadRequest, `"field":"`+c.field+`"`)
	}

	// Il testo si salva così com'è: React fa l'escape quando lo mostra
	title := `Stanza all'ultimo piano & terrazzo <img src=x onerror=alert(1)>`
	rec := app.do(http.MethodPost, "/api/v1/listings", listingWith(map[string]any{
		"title": "  " + title + "\x00 ", "amenities": []string{"wifi", "balcone", "wifi"}, "availableFrom": nextYear,
	}), withSession(landlord.Cookie))
	expect(t, rec, http.StatusCreated, "")
	var detail listingDetail
	decode(t, rec, &detail)
	if detail.Title != title || !detail.IsOwner || !detail.IsActive || detail.Owner.FirstName != "Marco" {
		t.Fatalf("annuncio creato = %+v", detail)
	}
	if strings.Join(detail.Amenities, ",") != "wifi,balcone" {
		t.Errorf("servizi = %v, attesi senza duplicati e nell'ordine fisso", detail.Amenities)
	}
	if detail.BillsIncluded == nil || !*detail.BillsIncluded || detail.AvailableFrom == nil || *detail.AvailableFrom != nextYear {
		t.Errorf("spese o disponibilità = %v, %v", detail.BillsIncluded, detail.AvailableFrom)
	}
	if len(detail.Images) != 0 || detail.CoverURL != nil {
		t.Errorf("un annuncio nuovo non ha foto: %+v", detail)
	}
}

func TestReadListings(t *testing.T) {
	app := newApp(t)
	landlord := app.registerUser("Marco", "affitta", false)
	id := app.createListing(landlord.Cookie, nil)

	rec := app.do(http.MethodGet, "/api/v1/listings", nil)
	expect(t, rec, http.StatusOK, `"coverUrl":null`)
	var list []map[string]any
	decode(t, rec, &list)
	if len(list) != 1 || list[0]["title"] != "Singola in zona Isola" || list[0]["roomType"] != "singola" || list[0]["billsIncluded"] != true {
		t.Fatalf("elenco = %s", rec.Body.String())
	}
	// Nessun dato inventato
	for _, fake := range []string{"avail", "color", "emoji", "tags"} {
		if _, found := list[0][fake]; found {
			t.Errorf("l'elenco contiene %q", fake)
		}
	}

	// Chi non è il proprietario vede lo stesso annuncio senza isOwner
	detail, _ := app.listing(id, "")
	if detail == nil || detail.IsOwner || detail.Description != "Stanza luminosa vicino alla M5" || strings.Join(detail.Amenities, ",") != "wifi,lavatrice" {
		t.Fatalf("dettaglio = %+v", detail)
	}

	for _, path := range []string{"/api/v1/listings/abc", "/api/v1/listings/0", "/api/v1/listings/99999"} {
		expect(t, app.do(http.MethodGet, path, nil), http.StatusNotFound, "listing_not_found")
	}

	expect(t, app.do(http.MethodGet, "/api/v1/me/listings", nil), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodGet, "/api/v1/me/listings", nil, withSession(landlord.Cookie)), http.StatusOK, `"isActive":true`)
}

func TestEmptyListsAreArrays(t *testing.T) {
	app := newApp(t)
	seeker := app.registerUser("Giulia", "cerca", false)

	expect(t, app.do(http.MethodGet, "/api/v1/listings", nil), http.StatusOK, "[]")
	expect(t, app.do(http.MethodGet, "/api/v1/me/listings", nil, withSession(seeker.Cookie)), http.StatusOK, "[]")
	expect(t, app.do(http.MethodGet, "/api/get_chats", nil, withSession(seeker.Cookie)), http.StatusOK, "[]")
}

func TestUpdateListing(t *testing.T) {
	app := newApp(t)
	owner := app.registerUser("Marco", "affitta", false)
	other := app.registerUser("Luca", "affitta", false)
	id := app.createListing(owner.Cookie, nil)
	path := "/api/v1/listings/" + itoa(id)

	changes := listingWith(map[string]any{
		"title": "Singola rinnovata", "price": 700, "amenities": []string{}, "billsIncluded": false, "zone": "",
	})
	expect(t, app.do(http.MethodPut, path, changes), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodPut, path, changes, withSession(other.Cookie)), http.StatusForbidden, "listing_not_owned")
	expect(t, app.do(http.MethodPut, "/api/v1/listings/99999", changes, withSession(owner.Cookie)), http.StatusNotFound, "")
	expect(t, app.do(http.MethodPut, path, listingWith(map[string]any{"price": -5}), withSession(owner.Cookie)), http.StatusBadRequest, `"field":"price"`)

	rec := app.do(http.MethodPut, path, changes, withSession(owner.Cookie))
	expect(t, rec, http.StatusOK, "")
	detail, _ := app.listing(id, "")
	if detail.Title != "Singola rinnovata" || detail.Price != 700 || len(detail.Amenities) != 0 || detail.Zone != "" ||
		detail.BillsIncluded == nil || *detail.BillsIncluded {
		t.Fatalf("annuncio modificato = %+v", detail)
	}
}

func TestActivateListing(t *testing.T) {
	app := newApp(t)
	owner := app.registerUser("Marco", "affitta", false)
	seeker := app.registerUser("Giulia", "cerca", false)
	id := app.createListing(owner.Cookie, nil)
	path := "/api/v1/listings/" + itoa(id) + "/active"

	expect(t, app.do(http.MethodPut, path, map[string]bool{"active": false}, withSession(seeker.Cookie)), http.StatusForbidden, "")
	expect(t, app.do(http.MethodPut, path, map[string]any{}, withSession(owner.Cookie)), http.StatusBadRequest, "invalid_active")
	expect(t, app.do(http.MethodPut, path, map[string]bool{"active": false}, withSession(owner.Cookie)), http.StatusNoContent, "")

	if ids := app.publicListingIDs(); len(ids) != 0 {
		t.Fatalf("un annuncio disattivato non va nell'elenco pubblico: %v", ids)
	}
	if _, code := app.listing(id, seeker.Cookie); code != http.StatusNotFound {
		t.Fatalf("dettaglio di un annuncio disattivato per un altro utente: %d", code)
	}
	if detail, _ := app.listing(id, owner.Cookie); detail == nil || detail.IsActive {
		t.Fatalf("il proprietario vede il suo annuncio disattivato: %+v", detail)
	}
	expect(t, app.do(http.MethodGet, "/api/v1/me/listings", nil, withSession(owner.Cookie)), http.StatusOK, `"isActive":false`)
	expect(t, app.do(http.MethodPost, "/api/start_chat", map[string]int{"listingId": id}, withSession(seeker.Cookie)), http.StatusNotFound, "non più disponibile")

	expect(t, app.do(http.MethodPut, path, map[string]bool{"active": true}, withSession(owner.Cookie)), http.StatusNoContent, "")
	if ids := app.publicListingIDs(); len(ids) != 1 {
		t.Fatalf("annuncio riattivato assente dall'elenco: %v", ids)
	}
}

func TestDeleteListing(t *testing.T) {
	app := newApp(t)
	owner := app.registerUser("Marco", "affitta", true)
	other := app.registerUser("Luca", "affitta", false)
	seeker := app.registerUser("Giulia", "cerca", true)
	id := app.createListing(owner.Cookie, nil)
	imageKey := app.uploadImage(owner.Cookie, id, "image/jpeg", jpegBytes(100))
	path := "/api/v1/listings/" + itoa(id)

	expect(t, app.do(http.MethodDelete, path, nil), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodDelete, path, nil, withSession(seeker.Cookie)), http.StatusForbidden, "")
	expect(t, app.do(http.MethodDelete, path, nil, withSession(other.Cookie)), http.StatusForbidden, "listing_not_owned")
	expect(t, app.do(http.MethodDelete, "/api/v1/listings/x", nil, withSession(owner.Cookie)), http.StatusNotFound, "")

	// Con una conversazione collegata l'eliminazione funziona (F16) e la conversazione resta
	var started struct{ ConversationID int }
	rec := app.do(http.MethodPost, "/api/start_chat", map[string]int{"listingId": id}, withSession(seeker.Cookie))
	expect(t, rec, http.StatusOK, "")
	decode(t, rec, &started)
	expect(t, app.do(http.MethodPost, "/api/send_message", message(started.ConversationID, "ciao"), withSession(seeker.Cookie)), http.StatusOK, "")

	expect(t, app.do(http.MethodDelete, path, nil, withSession(owner.Cookie)), http.StatusNoContent, "")
	if _, code := app.listing(id, owner.Cookie); code != http.StatusNotFound {
		t.Fatalf("annuncio ancora presente: %d", code)
	}
	for _, key := range app.storage.keys() {
		if key == imageKey {
			t.Fatal("la foto dell'annuncio eliminato è rimasta nello storage")
		}
	}

	for _, u := range []user{owner, seeker} {
		rec := app.do(http.MethodGet, "/api/get_chats", nil, withSession(u.Cookie))
		expect(t, rec, http.StatusOK, `"id":`+itoa(started.ConversationID))
		expect(t, rec, http.StatusOK, b64("ciao-per-"))
	}
	expect(t, app.do(http.MethodPost, "/api/send_message", message(started.ConversationID, "ancora"), withSession(owner.Cookie)), http.StatusOK, "")
}

// Chi passa da "affitta" a "cerca" non pubblica più, ma gestisce ancora i propri annunci.
func TestOwnerManagesListingsAfterRoleChange(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Sara", "affitta", false)
	id := app.createListing(u.Cookie, nil)

	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(nil), withSession(u.Cookie)), http.StatusOK, `"userType":"cerca"`)
	expect(t, app.do(http.MethodPost, "/api/v1/listings", validListing(), withSession(u.Cookie)), http.StatusForbidden, "landlord_only")
	expect(t, app.do(http.MethodPut, "/api/v1/listings/"+itoa(id)+"/active", map[string]bool{"active": false}, withSession(u.Cookie)), http.StatusNoContent, "")
	expect(t, app.do(http.MethodDelete, "/api/v1/listings/"+itoa(id), nil, withSession(u.Cookie)), http.StatusNoContent, "")
}

// --- Foto ---

func jpegBytes(size int) []byte {
	return append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, bytes.Repeat([]byte{0x42}, size)...)
}

type pendingUpload struct {
	Key      string
	URL      string
	Headers  map[string]string
	MaxBytes int
}

func (a *testApp) prepareUpload(cookie string, listingID int, contentType string) (*pendingUpload, int, string) {
	a.t.Helper()
	rec := a.do(http.MethodPost, "/api/v1/listings/"+itoa(listingID)+"/images/uploads", map[string]string{"contentType": contentType}, withSession(cookie))
	if rec.Code != http.StatusCreated {
		return nil, rec.Code, rec.Body.String()
	}
	var up pendingUpload
	decode(a.t, rec, &up)
	return &up, rec.Code, rec.Body.String()
}

func (a *testApp) confirmUpload(cookie string, listingID int, key string) *httptest.ResponseRecorder {
	a.t.Helper()
	return a.do(http.MethodPost, "/api/v1/listings/"+itoa(listingID)+"/images", map[string]string{"key": key}, withSession(cookie))
}

// uploadImage esegue il caricamento completo (firma, invio, conferma) e restituisce la chiave finale.
func (a *testApp) uploadImage(cookie string, listingID int, contentType string, data []byte) string {
	a.t.Helper()
	up, code, body := a.prepareUpload(cookie, listingID, contentType)
	if up == nil {
		a.t.Fatalf("preparazione del caricamento: %d %s", code, body)
	}
	a.storage.put(up.Key, data)
	rec := a.confirmUpload(cookie, listingID, up.Key)
	expect(a.t, rec, http.StatusCreated, "")
	var img struct {
		ID  int
		URL string
	}
	decode(a.t, rec, &img)
	return strings.TrimPrefix(img.URL, "https://img.test/")
}

func TestListingImages(t *testing.T) {
	app := newApp(t)
	owner := app.registerUser("Marco", "affitta", false)
	other := app.registerUser("Luca", "affitta", false)
	id := app.createListing(owner.Cookie, nil)
	otherID := app.createListing(other.Cookie, nil)

	t.Run("autorizzazioni e formato", func(t *testing.T) {
		if _, code, _ := app.prepareUpload("", id, "image/jpeg"); code != http.StatusUnauthorized {
			t.Errorf("senza sessione: %d", code)
		}
		if _, code, _ := app.prepareUpload(other.Cookie, id, "image/jpeg"); code != http.StatusForbidden {
			t.Errorf("annuncio altrui: %d", code)
		}
		if _, code, body := app.prepareUpload(owner.Cookie, id, "image/gif"); code != http.StatusBadRequest || !strings.Contains(body, "invalid_image_type") {
			t.Errorf("GIF: %d %s", code, body)
		}
	})

	t.Run("caricamento, copertina e dettaglio", func(t *testing.T) {
		up, code, body := app.prepareUpload(owner.Cookie, id, "image/jpeg")
		if up == nil {
			t.Fatalf("%d %s", code, body)
		}
		if !strings.HasPrefix(up.Key, "pending/"+itoa(id)+"/") || up.Headers["Content-Type"] != "image/jpeg" || up.MaxBytes != 5<<20 {
			t.Fatalf("caricamento = %+v", up)
		}
		app.storage.put(up.Key, jpegBytes(1000))
		rec := app.confirmUpload(owner.Cookie, id, up.Key)
		expect(t, rec, http.StatusCreated, `"url":"https://img.test/listings/`+itoa(id)+`/`)

		// Il file in "pending/" è stato spostato
		for _, key := range app.storage.keys() {
			if strings.HasPrefix(key, "pending/") {
				t.Errorf("file rimasto in pending: %s", key)
			}
		}
		second := app.uploadImage(owner.Cookie, id, "image/png", append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 50)...))

		detail, _ := app.listing(id, "")
		if len(detail.Images) != 2 || detail.CoverURL == nil || *detail.CoverURL != detail.Images[0].URL || !strings.HasSuffix(detail.Images[1].URL, second) {
			t.Fatalf("foto nel dettaglio = %+v, copertina %v", detail.Images, detail.CoverURL)
		}
		rec = app.do(http.MethodGet, "/api/v1/listings", nil)
		expect(t, rec, http.StatusOK, `"coverUrl":"`+*detail.CoverURL+`"`)
	})

	t.Run("file non validi rifiutati ed eliminati", func(t *testing.T) {
		reject := func(name, contentType string, data []byte, wantCode string) {
			up, code, body := app.prepareUpload(owner.Cookie, id, contentType)
			if up == nil {
				t.Fatalf("%s: %d %s", name, code, body)
			}
			app.storage.put(up.Key, data)
			rec := app.confirmUpload(owner.Cookie, id, up.Key)
			expect(t, rec, http.StatusBadRequest, wantCode)
			for _, key := range app.storage.keys() {
				if key == up.Key {
					t.Errorf("%s: file non valido rimasto nello storage", name)
				}
			}
		}
		reject("HTML travestito da JPEG", "image/jpeg", []byte("<html><script>alert(1)</script>"), "invalid_image")
		reject("PNG dichiarato come WebP", "image/webp", append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 50)...), "invalid_image")
		reject("oltre 5 MB", "image/jpeg", jpegBytes(5<<20), "invalid_image")

		// Chiave di un altro annuncio, chiave inventata, file mai caricato
		otherUp, _, _ := app.prepareUpload(other.Cookie, otherID, "image/jpeg")
		app.storage.put(otherUp.Key, jpegBytes(10))
		expect(t, app.confirmUpload(owner.Cookie, id, otherUp.Key), http.StatusBadRequest, "invalid_upload")
		expect(t, app.confirmUpload(owner.Cookie, id, "listings/"+itoa(otherID)+"/x.jpg"), http.StatusBadRequest, "invalid_upload")
		expect(t, app.confirmUpload(owner.Cookie, id, "pending/"+itoa(id)+"/00000000000000000000000000000000.jpg"), http.StatusBadRequest, "upload_not_found")
		expect(t, app.confirmUpload(other.Cookie, id, otherUp.Key), http.StatusForbidden, "")
	})

	t.Run("massimo 8 foto", func(t *testing.T) {
		detail, _ := app.listing(id, "")
		for i := len(detail.Images); i < 8; i++ {
			app.uploadImage(owner.Cookie, id, "image/jpeg", jpegBytes(10))
		}
		if _, code, body := app.prepareUpload(owner.Cookie, id, "image/jpeg"); code != http.StatusConflict || !strings.Contains(body, "too_many_images") {
			t.Fatalf("nona foto: %d %s", code, body)
		}
	})

	t.Run("eliminazione di una foto", func(t *testing.T) {
		detail, _ := app.listing(id, "")
		first := detail.Images[0]
		path := "/api/v1/listings/" + itoa(id) + "/images/" + itoa(first.ID)
		expect(t, app.do(http.MethodDelete, path, nil, withSession(other.Cookie)), http.StatusForbidden, "")
		expect(t, app.do(http.MethodDelete, "/api/v1/listings/"+itoa(otherID)+"/images/"+itoa(first.ID), nil, withSession(other.Cookie)), http.StatusNotFound, "image_not_found")
		expect(t, app.do(http.MethodDelete, path, nil, withSession(owner.Cookie)), http.StatusNoContent, "")
		expect(t, app.do(http.MethodDelete, path, nil, withSession(owner.Cookie)), http.StatusNotFound, "")

		for _, key := range app.storage.keys() {
			if "https://img.test/"+key == first.URL {
				t.Error("foto eliminata ancora nello storage")
			}
		}
		after, _ := app.listing(id, "")
		if len(after.Images) != 7 || *after.CoverURL != after.Images[0].URL {
			t.Fatalf("foto dopo l'eliminazione = %d, copertina %v", len(after.Images), after.CoverURL)
		}
	})
}

func TestListingImagesWithoutStorage(t *testing.T) {
	app := newAppWithStorage(t, storage.Disabled{})
	owner := app.registerUser("Marco", "affitta", false)
	id := app.createListing(owner.Cookie, nil)

	rec := app.do(http.MethodPost, "/api/v1/listings/"+itoa(id)+"/images/uploads", map[string]string{"contentType": "image/jpeg"}, withSession(owner.Cookie))
	expect(t, rec, http.StatusServiceUnavailable, "uploads_unavailable")
	// Senza storage l'annuncio si può comunque eliminare
	expect(t, app.do(http.MethodDelete, "/api/v1/listings/"+itoa(id), nil, withSession(owner.Cookie)), http.StatusNoContent, "")
}

// Il testo al limite delle colonne VARCHAR del database si salva senza errori, così come
// la città dal nome più lungo e quella con l'apostrofo.
func TestListingTextAtColumnLimits(t *testing.T) {
	app := newApp(t)
	owner := app.registerUser("Marco", "affitta", false)
	title := strings.Repeat("è", 100)
	for _, city := range []string{"Reggio Calabria", "L'Aquila", "Forlì"} {
		id := app.createListing(owner.Cookie, map[string]any{"title": title, "city": city, "zone": strings.Repeat("z", 80)})
		detail, _ := app.listing(id, "")
		if detail.Title != title || detail.City != city {
			t.Fatalf("testo salvato = %q, %q", detail.Title, detail.City)
		}
	}
}

// In produzione user_id, room_type, first_name e last_name possono essere NULL:
// annunci e profili con questi campi vuoti non devono rompere gli elenchi.
func TestNullableProductionColumns(t *testing.T) {
	app := newApp(t)
	owner := app.registerUser("Marco", "affitta", false)
	seeker := app.registerUser("Giulia", "cerca", false)
	ownerless := app.createListing(owner.Cookie, map[string]any{"title": "Senza proprietario"})
	app.createListing(owner.Cookie, map[string]any{"title": "Senza tipo"})
	ctx := context.Background()
	for _, query := range []string{
		`UPDATE roomdate_app.listings SET user_id = NULL WHERE title = 'Senza proprietario'`,
		`UPDATE roomdate_app.listings SET room_type = NULL WHERE title = 'Senza tipo'`,
		`UPDATE roomdate_app.users SET first_name = NULL, last_name = NULL WHERE email = 'marco@test.it'`,
		`UPDATE roomdate_app.users SET first_name = NULL, last_name = NULL, citta = NULL, occupation = NULL, bio = NULL,
             birthdate = NULL, budget_max = NULL, is_public = NULL, user_type = 'cerca', created_at = NULL
         WHERE email = 'giulia@test.it'`,
	} {
		if _, err := testPool.Exec(ctx, query); err != nil {
			t.Fatal(err)
		}
	}

	if ids := app.publicListingIDs(); len(ids) != 2 {
		t.Fatalf("elenco annunci = %v", ids)
	}
	if detail, code := app.listing(ownerless, seeker.Cookie); detail == nil || detail.IsOwner {
		t.Fatalf("dettaglio senza proprietario: %d %+v", code, detail)
	}
	expect(t, app.do(http.MethodPost, "/api/start_chat", map[string]int{"listingId": ownerless}, withSession(seeker.Cookie)), http.StatusNotFound, "non più disponibile")
	expect(t, app.do(http.MethodGet, "/api/v1/me/listings", nil, withSession(owner.Cookie)), http.StatusOK, "Senza tipo")
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": owner.Email, "password": owner.Password}), http.StatusOK, `"firstName":""`)
	expect(t, app.do(http.MethodGet, "/api/v1/me", nil, withSession(owner.Cookie)), http.StatusOK, `"lastName":""`)
	expect(t, app.do(http.MethodGet, "/api/v1/roommates", nil, withSession(owner.Cookie)), http.StatusOK,
		`"firstName":"","age":null,"city":"","occupation":"","bio":"","lifestyleTags":["socievole"],"budgetMax":0`)
	expect(t, app.do(http.MethodGet, "/api/v1/users/"+seeker.ID, nil, withSession(owner.Cookie)), http.StatusOK, `"age":null`)
}

func TestListingConstraintsInDatabase(t *testing.T) {
	app := newApp(t)
	owner := app.registerUser("Marco", "affitta", false)
	ctx := context.Background()
	for _, query := range []string{
		`INSERT INTO roomdate_app.listings (user_id, title, city, room_type, price) VALUES ($1, 't', 'c', 'suite', 100)`,
		`INSERT INTO roomdate_app.listings (user_id, title, city, room_type, price) VALUES ($1, 't', 'c', 'singola', 0)`,
	} {
		if _, err := testPool.Exec(ctx, query, owner.ID); err == nil {
			t.Errorf("vincolo non applicato: %s", query)
		}
	}
}
