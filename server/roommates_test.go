package server_test

import (
	"context"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"testing"
)

type roommatesPage struct {
	Items []struct {
		ID, FirstName, City, Occupation, Bio string
		Age                                  *int
		LifestyleTags                        []string
		BudgetMax                            int
		Compatibility                        *struct {
			SameCity, SimilarBudget, SmokingMismatch bool
			SharedTags                               []string
		}
	}
	NextCursor *string
}

func (a *testApp) roommates(query, cookie string) roommatesPage {
	a.t.Helper()
	rec := a.do(http.MethodGet, "/api/v1/roommates"+query, nil, withSession(cookie))
	expect(a.t, rec, http.StatusOK, "")
	var page roommatesPage
	decode(a.t, rec, &page)
	return page
}

// setProfile imposta città, budget e abitudini di un utente direttamente nel database.
func setProfile(t *testing.T, id, city string, budget int, tags ...string) {
	t.Helper()
	_, err := testPool.Exec(context.Background(),
		`UPDATE roomdate_app.users SET citta = $2, budget_max = $3, lifestyle_tags = $4 WHERE id = $1`, id, city, budget, append([]string{}, tags...))
	if err != nil {
		t.Fatal(err)
	}
}

// Anomalia F18: l'elenco mostra solo i profili pubblici di chi cerca una stanza, escluso chi guarda.
func TestRoommates(t *testing.T) {
	app := newApp(t)
	giulia := app.registerUser("Giulia", "cerca", false)
	anna := app.registerUser("Anna", "cerca", false)
	bruno := app.registerUser("Bruno", "affitta", false)
	carla := app.registerUser("Carla", "cerca", false)
	dario := app.registerUser("Dario", "cerca", false)
	testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET is_public = false WHERE id = $1`, carla.ID)
	setProfile(t, giulia.ID, "Milano", 600, "non_fumatore", "ordinato")
	setProfile(t, anna.ID, "Milano", 700, "non_fumatore", "socievole", "ordinato")
	setProfile(t, dario.ID, "Roma", 450, "fumatore")

	ids := func(p roommatesPage) []string {
		var out []string
		for _, item := range p.Items {
			out = append(out, item.ID)
		}
		return out
	}

	t.Run("senza sessione: chi cerca, pubblico, dal più recente", func(t *testing.T) {
		rec := app.do(http.MethodGet, "/api/v1/roommates", nil)
		expect(t, rec, http.StatusOK, "")
		for _, private := range []string{"@test.it", "Rossi", "1999-01-01", "birthdate", "lastName", "email", "isPublic"} {
			if strings.Contains(rec.Body.String(), private) {
				t.Errorf("l'elenco contiene %q: %s", private, rec.Body.String())
			}
		}
		var page roommatesPage
		decode(t, rec, &page)
		if got, want := ids(page), []string{dario.ID, anna.ID, giulia.ID}; !slices.Equal(got, want) {
			t.Fatalf("elenco = %v, atteso %v (niente chi affitta né profili privati)", got, want)
		}
		if page.NextCursor != nil || page.Items[0].Compatibility != nil || page.Items[0].Age == nil {
			t.Fatalf("pagina = %s", rec.Body.String())
		}
	})

	t.Run("con sessione: esclude chi guarda e spiega cosa c'è in comune", func(t *testing.T) {
		page := app.roommates("", giulia.Cookie)
		if got, want := ids(page), []string{dario.ID, anna.ID}; !slices.Equal(got, want) {
			t.Fatalf("elenco = %v, atteso %v", got, want)
		}
		withDario, withAnna := page.Items[0].Compatibility, page.Items[1].Compatibility
		if withAnna == nil || !withAnna.SameCity || !withAnna.SimilarBudget || withAnna.SmokingMismatch ||
			!slices.Equal(withAnna.SharedTags, []string{"non_fumatore", "ordinato"}) {
			t.Errorf("compatibilità con Anna = %+v", withAnna)
		}
		if withDario == nil || withDario.SameCity || withDario.SimilarBudget || !withDario.SmokingMismatch || len(withDario.SharedTags) != 0 {
			t.Errorf("compatibilità con Dario = %+v", withDario)
		}
		// Chi affitta vede i profili di chi cerca, con la compatibilità calcolata sui propri dati
		if got := ids(app.roommates("", bruno.Cookie)); len(got) != 3 {
			t.Errorf("elenco visto da chi affitta = %v", got)
		}
	})

	t.Run("filtro per città", func(t *testing.T) {
		if got := ids(app.roommates("?city=Milano", giulia.Cookie)); !slices.Equal(got, []string{anna.ID}) {
			t.Errorf("Milano = %v", got)
		}
		if got := app.roommates("?city="+url.QueryEscape("L'Aquila"), ""); len(got.Items) != 0 || got.Items == nil {
			t.Errorf("città senza profili = %+v (atteso elenco vuoto, non null)", got)
		}
	})

	t.Run("parametri non validi", func(t *testing.T) {
		for query, field := range map[string]string{
			"?city=Gotham": "city", "?city=milano": "city",
			"?limit=0": "limit", "?limit=51": "limit", "?limit=tre": "limit",
			"?cursor=abc": "cursor", "?cursor=" + url.QueryEscape("MTIzX3gnOyBEUk9QIFRBQkxF"): "cursor",
		} {
			rec := app.do(http.MethodGet, "/api/v1/roommates"+query, nil)
			expect(t, rec, http.StatusBadRequest, `"field":"`+field+`"`)
			expectNoLeak(t, rec)
		}
	})
}

// Scorrendo le pagine si vede ogni profilo una sola volta, anche con date di creazione uguali o mancanti.
func TestRoommatesPagination(t *testing.T) {
	app := newApp(t)
	names := []string{"Uno", "Due", "Tre", "Quattro", "Cinque", "Sei", "Sette"}
	users := map[string]string{}
	for _, name := range names {
		users[app.registerUser(name, "cerca", false).ID] = name
	}
	ctx := context.Background()
	// Uno e Due creati nello stesso istante; Sette senza data di creazione (possibile in produzione)
	for _, name := range []string{"Uno", "Due"} {
		if _, err := testPool.Exec(ctx, `UPDATE roomdate_app.users SET created_at = '2026-01-01 10:00:00.123456+00' WHERE first_name = $1`, name); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := testPool.Exec(ctx, `UPDATE roomdate_app.users SET created_at = NULL WHERE first_name = 'Sette'`); err != nil {
		t.Fatal(err)
	}
	var expected []string
	rows, err := testPool.Query(ctx, `SELECT id::text FROM roomdate_app.users ORDER BY created_at DESC NULLS LAST, id DESC`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var id string
		rows.Scan(&id)
		expected = append(expected, id)
	}

	// Con 7 profili: il numero di pagine atteso per ogni dimensione, senza pagine vuote in fondo
	for limit, wantPages := range map[string]int{"1": 7, "2": 4, "3": 3, "7": 1, "50": 1} {
		var seen []string
		pages := 0
		query := "?limit=" + limit
		for {
			pages++
			if pages > len(names)+1 {
				t.Fatalf("limit=%s: la paginazione non termina", limit)
			}
			page := app.roommates(query, "")
			for _, item := range page.Items {
				seen = append(seen, item.ID)
			}
			if page.NextCursor == nil {
				break
			}
			query = "?limit=" + limit + "&cursor=" + url.QueryEscape(*page.NextCursor)
		}
		if !slices.Equal(seen, expected) || pages != wantPages {
			t.Errorf("limit=%s: %d pagine (attese %d), visti %v, attesi %v", limit, pages, wantPages, seen, expected)
		}
	}
	if users[expected[len(expected)-1]] != "Sette" {
		t.Error("i profili senza data di creazione vanno in fondo")
	}
}
