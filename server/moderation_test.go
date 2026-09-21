package server_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"roomdate-backend/internal/realtime"
	"roomdate-backend/shared"
)

// Modulo M3.3: blocchi, segnalazioni e moderazione.

func (a *testApp) block(cookie, userID string) *httptest.ResponseRecorder {
	a.t.Helper()
	return a.do(http.MethodPut, "/api/v1/me/blocks/"+userID, nil, withSession(cookie))
}

func roommateIDs(t *testing.T, app *testApp, cookie string) []string {
	t.Helper()
	rec := app.do(http.MethodGet, "/api/v1/roommates", nil, withSession(cookie))
	expect(t, rec, http.StatusOK, "")
	var page struct{ Items []struct{ ID string } }
	decode(t, rec, &page)
	var ids []string
	for _, r := range page.Items {
		ids = append(ids, r.ID)
	}
	return ids
}

func listingIDsFor(t *testing.T, app *testApp, cookie string) []int {
	t.Helper()
	rec := app.do(http.MethodGet, "/api/v1/listings", nil, withSession(cookie))
	expect(t, rec, http.StatusOK, "")
	var page listingsPage
	decode(t, rec, &page)
	var ids []int
	for _, l := range page.Items {
		ids = append(ids, l.ID)
	}
	return ids
}

func conversationByID(t *testing.T, app *testApp, cookie string, id int) conversationItem {
	t.Helper()
	for _, c := range app.conversations(cookie) {
		if c.ID == id {
			return c
		}
	}
	t.Fatalf("conversazione %d non trovata", id)
	return conversationItem{}
}

// Un blocco vale nei due sensi: nessuno dei due può più scrivere all'altro, né trovarlo nelle
// ricerche. La conversazione resta leggibile, e togliendo il blocco torna tutto come prima.
func TestBlocking(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	// Anche Marco cerca coinquilini, così compare nell'elenco (prima del blocco)
	testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET user_type = 'cerca' WHERE id = $1`, f.marco.ID)
	if !slices.Contains(roommateIDs(t, app, f.anna.Cookie), f.marco.ID) || !slices.Contains(listingIDsFor(t, app, f.anna.Cookie), f.listingID) {
		t.Fatal("prima del blocco Anna vede Marco e il suo annuncio")
	}

	expect(t, app.block(f.anna.Cookie, f.marco.ID), http.StatusNoContent, "")
	expect(t, app.block(f.anna.Cookie, f.marco.ID), http.StatusNoContent, "") // ripetuto: nessun errore
	rec := app.do(http.MethodGet, "/api/v1/me/blocks", nil, withSession(f.anna.Cookie))
	expect(t, rec, http.StatusOK, `"firstName":"Marco"`)
	expect(t, app.do(http.MethodGet, "/api/v1/me/blocks", nil, withSession(f.marco.Cookie)), http.StatusOK, `{"items":[]}`)

	t.Run("profili e ricerche", func(t *testing.T) {
		expect(t, app.do(http.MethodGet, "/api/v1/users/"+f.marco.ID, nil, withSession(f.anna.Cookie)), http.StatusNotFound, "")
		expect(t, app.do(http.MethodGet, "/api/v1/users/"+f.anna.ID, nil, withSession(f.marco.Cookie)), http.StatusNotFound, "")
		expect(t, app.do(http.MethodGet, "/api/v1/users/"+f.marco.ID, nil, withSession(f.carla.Cookie)), http.StatusOK, "")
		if slices.Contains(roommateIDs(t, app, f.anna.Cookie), f.marco.ID) || slices.Contains(roommateIDs(t, app, f.marco.Cookie), f.anna.ID) {
			t.Error("i due utenti non devono vedersi tra i coinquilini")
		}
		if !slices.Contains(roommateIDs(t, app, f.carla.Cookie), f.marco.ID) {
			t.Error("gli altri continuano a vedere Marco")
		}
		if slices.Contains(listingIDsFor(t, app, f.anna.Cookie), f.listingID) {
			t.Error("Anna non deve più vedere l'annuncio di Marco")
		}
		if !slices.Contains(listingIDsFor(t, app, f.carla.Cookie), f.listingID) || !slices.Contains(app.publicListingIDs(), f.listingID) {
			t.Error("l'annuncio resta visibile agli altri e a chi non ha una sessione")
		}
		if _, status := app.listing(f.listingID, f.anna.Cookie); status != http.StatusNotFound {
			t.Errorf("dettaglio dell'annuncio per Anna: %d", status)
		}
	})

	t.Run("chat", func(t *testing.T) {
		for _, u := range []user{f.anna, f.marco} {
			rec := app.do(http.MethodPost, "/api/v1/conversations/"+itoa(f.directChat)+"/messages",
				message("ciao", f.anna, f.marco), withSession(u.Cookie))
			expect(t, rec, http.StatusForbidden, "conversation_blocked")
			// I messaggi già scambiati restano leggibili
			expect(t, app.do(http.MethodGet, "/api/v1/conversations/"+itoa(f.directChat)+"/messages", nil, withSession(u.Cookie)), http.StatusOK, "")
			// Nemmeno "sta scrivendo" può più passare
			rec = app.do(http.MethodPost, realtimeAuthPath,
				map[string]string{"socketId": "1.2", "channelName": realtime.ConversationChannel(f.directChat)}, withSession(u.Cookie))
			expect(t, rec, http.StatusForbidden, "channel_forbidden")
		}
		expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]any{"targetId": f.anna.ID}, withSession(f.marco.Cookie)),
			http.StatusForbidden, "user_blocked")
		expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]any{"listingId": f.listingID}, withSession(f.anna.Cookie)),
			http.StatusForbidden, "user_blocked")
		if c := conversationByID(t, app, f.anna.Cookie, f.directChat); c.Blocked == nil || *c.Blocked != "by_me" {
			t.Errorf("per Anna la conversazione è bloccata da lei: %v", c.Blocked)
		}
		if c := conversationByID(t, app, f.marco.Cookie, f.directChat); c.Blocked == nil || *c.Blocked != "by_other" {
			t.Errorf("per Marco la conversazione è bloccata dall'altro: %v", c.Blocked)
		}
		// Carla non c'entra: le sue conversazioni non cambiano
		carlaChat := app.startChat(f.carla.Cookie, map[string]any{"targetId": f.marco.ID})
		app.send(f.carla.Cookie, carlaChat, message("ciao Marco", f.carla, f.marco))
	})

	t.Run("richieste non valide", func(t *testing.T) {
		expect(t, app.block(f.anna.Cookie, f.anna.ID), http.StatusBadRequest, "self_block")
		expect(t, app.block(f.anna.Cookie, "00000000-0000-0000-0000-000000000000"), http.StatusNotFound, "user_not_found")
		expect(t, app.block(f.anna.Cookie, "non-un-id"), http.StatusNotFound, "")
		expect(t, app.block("", f.marco.ID), http.StatusUnauthorized, "")
		expect(t, app.do(http.MethodPut, "/api/v1/me/blocks/"+f.marco.ID, nil, withSession(f.anna.Cookie),
			withHeader("Origin", "https://evil.example")), http.StatusForbidden, "")
	})

	// Sbloccare è idempotente e ripristina tutto
	for i := 0; i < 2; i++ {
		expect(t, app.do(http.MethodDelete, "/api/v1/me/blocks/"+f.marco.ID, nil, withSession(f.anna.Cookie)), http.StatusNoContent, "")
	}
	app.send(f.marco.Cookie, f.directChat, message("di nuovo", f.anna, f.marco))
	expect(t, app.do(http.MethodGet, "/api/v1/users/"+f.marco.ID, nil, withSession(f.anna.Cookie)), http.StatusOK, "")
	if c := conversationByID(t, app, f.anna.Cookie, f.directChat); c.Blocked != nil {
		t.Errorf("dopo lo sblocco la conversazione non è più bloccata: %v", *c.Blocked)
	}
	// Il blocco di Marco su Anna vale come quello di Anna su Marco
	expect(t, app.block(f.marco.Cookie, f.anna.ID), http.StatusNoContent, "")
	expect(t, app.do(http.MethodGet, "/api/v1/users/"+f.marco.ID, nil, withSession(f.anna.Cookie)), http.StatusNotFound, "")
}

func report(fields map[string]any) map[string]any {
	body := map[string]any{"reason": "harassment", "details": "Mi ha scritto insulti"}
	for k, v := range fields {
		body[k] = v
	}
	return body
}

func (a *testApp) report(cookie string, fields map[string]any) *httptest.ResponseRecorder {
	a.t.Helper()
	return a.do(http.MethodPost, "/api/v1/reports", report(fields), withSession(cookie))
}

func TestReports(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	evidence := []map[string]any{{"text": "sei un idiota", "sentAt": "2026-09-20T18:30:00Z"}}

	var first struct{ ID int64 }
	rec := app.report(f.anna.Cookie, map[string]any{"userId": f.marco.ID})
	expect(t, rec, http.StatusCreated, "")
	decode(t, rec, &first)
	// Un secondo invio non crea un doppione
	rec = app.report(f.anna.Cookie, map[string]any{"userId": f.marco.ID})
	expect(t, rec, http.StatusOK, `"id":`+itoa(int(first.ID)))
	// L'annuncio è un'altra segnalazione, anche se il proprietario è lo stesso
	expect(t, app.report(f.anna.Cookie, map[string]any{"listingId": f.listingID, "reason": "fake_listing"}), http.StatusCreated, "")
	// Dalla chat si possono allegare i messaggi ricevuti
	expect(t, app.report(f.carla.Cookie, map[string]any{"userId": f.anna.ID, "reason": "spam"}), http.StatusCreated, "")
	rec = app.report(f.marco.Cookie, map[string]any{"userId": f.anna.ID, "conversationId": f.directChat, "evidence": evidence})
	expect(t, rec, http.StatusCreated, "")
	var stored string
	testPool.QueryRow(context.Background(), `SELECT evidence::text FROM roomdate_app.reports WHERE reporter_id = $1`, f.marco.ID).Scan(&stored)
	if !strings.Contains(stored, "sei un idiota") {
		t.Errorf("messaggi allegati salvati: %s", stored)
	}

	long := strings.Repeat("a", 1001)
	tooMany := make([]map[string]any, 21)
	for i := range tooMany {
		tooMany[i] = evidence[0]
	}
	for name, c := range map[string]struct {
		cookie string
		fields map[string]any
		status int
		code   string
	}{
		"motivo sconosciuto":    {f.anna.Cookie, map[string]any{"userId": f.carla.ID, "reason": "antipatico"}, 400, "validation_failed"},
		"né utente né annuncio": {f.anna.Cookie, map[string]any{}, 400, "validation_failed"},
		"utente e annuncio":     {f.anna.Cookie, map[string]any{"userId": f.carla.ID, "listingId": f.listingID}, 400, "validation_failed"},
		"descrizione lunga":     {f.anna.Cookie, map[string]any{"userId": f.carla.ID, "details": long}, 400, "validation_failed"},
		"allegati senza chat":   {f.anna.Cookie, map[string]any{"userId": f.marco.ID, "evidence": evidence}, 400, "validation_failed"},
		"troppi allegati":       {f.anna.Cookie, map[string]any{"userId": f.marco.ID, "conversationId": f.directChat, "evidence": tooMany}, 400, "validation_failed"},
		"allegato lungo":        {f.anna.Cookie, map[string]any{"userId": f.marco.ID, "conversationId": f.directChat, "evidence": []map[string]any{{"text": long, "sentAt": "2026-09-20T18:30:00Z"}}}, 400, "validation_failed"},
		"allegato vuoto":        {f.anna.Cookie, map[string]any{"userId": f.marco.ID, "conversationId": f.directChat, "evidence": []map[string]any{{"text": " ", "sentAt": "2026-09-20T18:30:00Z"}}}, 400, "validation_failed"},
		"chat di altri":         {f.carla.Cookie, map[string]any{"userId": f.marco.ID, "conversationId": f.directChat, "evidence": evidence}, 403, "not_participant"},
		"sé stessi":             {f.anna.Cookie, map[string]any{"userId": f.anna.ID}, 400, "self_report"},
		"il proprio annuncio":   {f.marco.Cookie, map[string]any{"listingId": f.listingID}, 400, "self_report"},
		"utente inesistente":    {f.anna.Cookie, map[string]any{"userId": "00000000-0000-0000-0000-000000000000"}, 404, "user_not_found"},
		"annuncio inesistente":  {f.anna.Cookie, map[string]any{"listingId": 9999}, 404, "listing_not_found"},
		"senza sessione":        {"", map[string]any{"userId": f.marco.ID}, 401, ""},
	} {
		t.Run(name, func(t *testing.T) {
			expect(t, app.report(c.cookie, c.fields), c.status, c.code)
		})
	}

	// Al massimo 10 segnalazioni al giorno per utente
	for i := 0; i < 10; i++ {
		testPool.Exec(context.Background(), `
            INSERT INTO roomdate_app.reports (reporter_id, target_user_id, reason, status, resolved_at)
            VALUES ($1, $2, 'spam', 'dismissed', now())`, f.carla.ID, f.marco.ID)
	}
	expect(t, app.report(f.carla.Cookie, map[string]any{"userId": f.marco.ID}), http.StatusTooManyRequests, "too_many_reports")
	testPool.Exec(context.Background(), `UPDATE roomdate_app.reports SET created_at = now() - interval '25 hours' WHERE reporter_id = $1`, f.carla.ID)
	expect(t, app.report(f.carla.Cookie, map[string]any{"userId": f.marco.ID}), http.StatusCreated, "")
}

// I motivi dell'elenco condiviso e quelli ammessi dal database devono coincidere.
func TestReportReasonsMatchDatabase(t *testing.T) {
	app := newApp(t)
	a := app.registerUser("Anna", "cerca", false)
	b := app.registerUser("Bruno", "cerca", false)
	for _, reason := range shared.ReportReasons {
		_, err := testPool.Exec(context.Background(), `
            INSERT INTO roomdate_app.reports (reporter_id, target_user_id, reason, status, resolved_at)
            VALUES ($1, $2, $3, 'dismissed', now())`, a.ID, b.ID, reason.Key)
		if err != nil {
			t.Errorf("motivo %q rifiutato dal database: %v", reason.Key, err)
		}
	}
	if _, err := testPool.Exec(context.Background(), `
        INSERT INTO roomdate_app.reports (reporter_id, target_user_id, reason) VALUES ($1, $2, 'antipatico')`, a.ID, b.ID); err == nil {
		t.Error("il database accetta un motivo fuori elenco")
	}
}

type adminReport struct {
	ID       int64
	Reason   string
	Details  string
	Status   string
	Evidence []struct {
		Text   string
		SentAt time.Time
	}
	Resolution string
	Reporter   *struct{ ID, FirstName string }
	Target     struct {
		ID, FirstName, LastName string
		Suspended, IsAdmin      bool
		OpenReports             int
	}
	Listing *struct {
		ID      int
		Title   string
		Removed bool
	}
}

type adminReportsPage struct {
	Items      []adminReport
	NextCursor *string
}

func (a *testApp) adminReports(cookie, query string) adminReportsPage {
	a.t.Helper()
	rec := a.do(http.MethodGet, "/api/v1/admin/reports"+query, nil, withSession(cookie))
	expect(a.t, rec, http.StatusOK, "")
	var page adminReportsPage
	decode(a.t, rec, &page)
	return page
}

func (a *testApp) resolve(cookie string, id int64, action string) *httptest.ResponseRecorder {
	a.t.Helper()
	return a.do(http.MethodPost, "/api/v1/admin/reports/"+itoa(int(id))+"/resolve",
		map[string]string{"action": action, "note": "controllato"}, withSession(cookie))
}

func makeAdmin(t *testing.T, u user) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET is_admin = true WHERE id = $1`, u.ID); err != nil {
		t.Fatal(err)
	}
}

func TestAdminAccess(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	app.report(f.anna.Cookie, map[string]any{"userId": f.marco.ID})

	for _, c := range []struct{ method, path string }{
		{http.MethodGet, "/api/v1/admin/reports"},
		{http.MethodPost, "/api/v1/admin/reports/1/resolve"},
		{http.MethodPost, "/api/v1/admin/users/" + f.marco.ID + "/unsuspend"},
		{http.MethodPost, "/api/v1/admin/listings/" + itoa(f.listingID) + "/restore"},
	} {
		body := map[string]string{"action": "dismiss"}
		expect(t, app.do(c.method, c.path, body), http.StatusUnauthorized, "")
		expect(t, app.do(c.method, c.path, body, withSession(f.anna.Cookie)), http.StatusForbidden, "admin_only")
	}
	if app.session(f.anna.Cookie).User == nil {
		t.Fatal("sessione di Anna")
	}
	expect(t, app.do(http.MethodGet, "/api/v1/auth/session", nil, withSession(f.anna.Cookie)), http.StatusOK, `"isAdmin":false`)

	makeAdmin(t, f.carla)
	expect(t, app.do(http.MethodGet, "/api/v1/auth/session", nil, withSession(f.carla.Cookie)), http.StatusOK, `"isAdmin":true`)
	if page := app.adminReports(f.carla.Cookie, ""); len(page.Items) != 1 {
		t.Fatalf("segnalazioni aperte per l'amministratore: %+v", page)
	}
	// Un amministratore sospeso perde l'accesso all'area di moderazione
	testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET suspended_at = now() WHERE id = $1`, f.carla.ID)
	expect(t, app.do(http.MethodGet, "/api/v1/admin/reports", nil, withSession(f.carla.Cookie)), http.StatusUnauthorized, "")
}

func TestAdminDismissAndList(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	makeAdmin(t, f.carla)
	evidence := []map[string]any{{"text": "paga subito la caparra", "sentAt": "2026-09-20T18:30:00Z"}}
	app.report(f.anna.Cookie, map[string]any{"userId": f.marco.ID, "reason": "scam", "conversationId": f.directChat, "evidence": evidence})
	app.report(f.anna.Cookie, map[string]any{"listingId": f.listingID, "reason": "fake_listing"})

	open := app.adminReports(f.carla.Cookie, "")
	if len(open.Items) != 2 || open.Items[0].Reason != "scam" || open.NextCursor != nil {
		t.Fatalf("segnalazioni aperte, dalla più vecchia: %+v", open)
	}
	first := open.Items[0]
	if first.Reporter == nil || first.Reporter.FirstName != "Anna" || first.Target.ID != f.marco.ID || first.Target.OpenReports != 2 ||
		len(first.Evidence) != 1 || first.Evidence[0].Text != "paga subito la caparra" || first.Listing != nil {
		t.Errorf("segnalazione = %+v", first)
	}
	if second := open.Items[1]; second.Listing == nil || second.Listing.ID != f.listingID || second.Listing.Title == "" {
		t.Errorf("segnalazione dell'annuncio = %+v", second)
	}

	expect(t, app.resolve(f.carla.Cookie, first.ID, "dismiss"), http.StatusNoContent, "")
	expect(t, app.resolve(f.carla.Cookie, first.ID, "dismiss"), http.StatusNotFound, "report_not_found")
	expect(t, app.resolve(f.carla.Cookie, open.Items[1].ID, "boh"), http.StatusBadRequest, "validation_failed")
	expect(t, app.resolve(f.carla.Cookie, 9999, "dismiss"), http.StatusNotFound, "")
	closed := app.adminReports(f.carla.Cookie, "?status=closed")
	if len(closed.Items) != 1 || closed.Items[0].Status != "dismissed" || closed.Items[0].Resolution != "controllato" {
		t.Errorf("segnalazioni chiuse = %+v", closed)
	}
	if page := app.adminReports(f.carla.Cookie, ""); len(page.Items) != 1 {
		t.Errorf("resta una segnalazione aperta: %+v", page)
	}
	expect(t, app.do(http.MethodGet, "/api/v1/admin/reports?status=tutte", nil, withSession(f.carla.Cookie)), http.StatusBadRequest, "")
	expect(t, app.do(http.MethodGet, "/api/v1/admin/reports?cursor=xyz", nil, withSession(f.carla.Cookie)), http.StatusBadRequest, "")

	// Le segnalazioni chiuse da più di 180 giorni si cancellano, con i messaggi allegati
	testPool.Exec(context.Background(), `UPDATE roomdate_app.reports SET resolved_at = now() - interval '181 days' WHERE id = $1`, first.ID)
	if closed := app.adminReports(f.carla.Cookie, "?status=closed"); len(closed.Items) != 0 {
		t.Errorf("segnalazione vecchia ancora presente: %+v", closed)
	}
}

func TestAdminReportsPagination(t *testing.T) {
	f := newChatFixture(t)
	makeAdmin(t, f.carla)
	for i := 0; i < 35; i++ {
		testPool.Exec(context.Background(), `
            INSERT INTO roomdate_app.reports (reporter_id, target_user_id, reason, details) VALUES (NULL, $1, 'spam', $2)`,
			f.marco.ID, itoa(i))
	}
	first := f.app.adminReports(f.carla.Cookie, "")
	if len(first.Items) != 30 || first.NextCursor == nil || first.Items[0].Details != "0" || first.Items[0].Reporter != nil {
		t.Fatalf("prima pagina: %d segnalazioni, cursore %v", len(first.Items), first.NextCursor)
	}
	second := f.app.adminReports(f.carla.Cookie, "?cursor="+*first.NextCursor)
	if len(second.Items) != 5 || second.NextCursor != nil || second.Items[0].Details != "30" {
		t.Fatalf("seconda pagina: %+v", second)
	}
}

// Rimuovere un annuncio lo nasconde a tutti tranne che al proprietario, che può solo eliminarlo.
func TestAdminRemovesListing(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	makeAdmin(t, f.carla)
	app.report(f.anna.Cookie, map[string]any{"listingId": f.listingID, "reason": "fake_listing"})
	app.report(f.carla.Cookie, map[string]any{"listingId": f.listingID, "reason": "scam"})
	userReport := app.report(f.anna.Cookie, map[string]any{"userId": f.marco.ID})
	var about struct{ ID int64 }
	decode(t, userReport, &about)

	reports := app.adminReports(f.carla.Cookie, "").Items
	expect(t, app.resolve(f.carla.Cookie, about.ID, "remove_listing"), http.StatusBadRequest, "no_listing")
	expect(t, app.resolve(f.carla.Cookie, reports[0].ID, "remove_listing"), http.StatusNoContent, "")
	// Chiude anche l'altra segnalazione sullo stesso annuncio, non quella sull'utente
	if open := app.adminReports(f.carla.Cookie, "").Items; len(open) != 1 || open[0].ID != about.ID {
		t.Errorf("segnalazioni aperte dopo la rimozione: %+v", open)
	}

	if slices.Contains(app.publicListingIDs(), f.listingID) {
		t.Error("l'annuncio rimosso non deve comparire nell'elenco")
	}
	if _, status := app.listing(f.listingID, f.anna.Cookie); status != http.StatusNotFound {
		t.Errorf("dettaglio per un altro utente: %d", status)
	}
	if detail, status := app.listing(f.listingID, f.carla.Cookie); status != http.StatusOK || !detail.Removed {
		t.Errorf("l'amministratore vede l'annuncio rimosso: %d %+v", status, detail)
	}
	detail, status := app.listing(f.listingID, f.marco.Cookie)
	if status != http.StatusOK || !detail.Removed || detail.IsActive {
		t.Errorf("il proprietario vede l'annuncio come rimosso: %d %+v", status, detail)
	}
	expect(t, app.do(http.MethodGet, "/api/v1/me/listings", nil, withSession(f.marco.Cookie)), http.StatusOK, `"removed":true`)
	expect(t, app.do(http.MethodPut, "/api/v1/listings/"+itoa(f.listingID)+"/active", map[string]bool{"active": true}, withSession(f.marco.Cookie)),
		http.StatusForbidden, "listing_removed")
	expect(t, app.do(http.MethodPut, "/api/v1/listings/"+itoa(f.listingID), validListing(), withSession(f.marco.Cookie)),
		http.StatusForbidden, "listing_removed")
	expect(t, app.do(http.MethodPost, "/api/v1/listings/"+itoa(f.listingID)+"/images/uploads", map[string]string{"contentType": "image/jpeg"},
		withSession(f.marco.Cookie)), http.StatusForbidden, "listing_removed")
	expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]any{"listingId": f.listingID}, withSession(f.carla.Cookie)),
		http.StatusNotFound, "listing_not_found")
	// La rimozione nasconde l'annuncio anche se risultasse attivo (es. dopo una modifica a mano nel database)
	testPool.Exec(context.Background(), `UPDATE roomdate_app.listings SET is_active = true WHERE id = $1`, f.listingID)
	if slices.Contains(app.publicListingIDs(), f.listingID) {
		t.Error("un annuncio rimosso non compare nell'elenco neanche se attivo")
	}
	if _, status := app.listing(f.listingID, f.anna.Cookie); status != http.StatusNotFound {
		t.Errorf("dettaglio di un annuncio rimosso ma attivo: %d", status)
	}
	expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]any{"listingId": f.listingID}, withSession(f.anna.Cookie)),
		http.StatusNotFound, "listing_not_found")
	testPool.Exec(context.Background(), `UPDATE roomdate_app.listings SET is_active = false WHERE id = $1`, f.listingID)

	// Ripristinato, resta disattivato finché il proprietario non lo riattiva
	expect(t, app.do(http.MethodPost, "/api/v1/admin/listings/"+itoa(f.listingID)+"/restore", nil, withSession(f.carla.Cookie)), http.StatusNoContent, "")
	expect(t, app.do(http.MethodPost, "/api/v1/admin/listings/9999/restore", nil, withSession(f.carla.Cookie)), http.StatusNotFound, "")
	if slices.Contains(app.publicListingIDs(), f.listingID) {
		t.Error("ripristinato ma ancora disattivato")
	}
	expect(t, app.do(http.MethodPut, "/api/v1/listings/"+itoa(f.listingID)+"/active", map[string]bool{"active": true}, withSession(f.marco.Cookie)),
		http.StatusNoContent, "")
	if !slices.Contains(app.publicListingIDs(), f.listingID) {
		t.Error("riattivato dal proprietario, torna nell'elenco")
	}
}

// Sospendere un account chiude le sue sessioni, gli impedisce di rientrare e lo nasconde.
func TestAdminSuspendsUser(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	makeAdmin(t, f.carla)
	app.send(f.marco.Cookie, f.directChat, message("ciao", f.anna, f.marco))
	testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET user_type = 'cerca' WHERE id = $1`, f.marco.ID)
	app.report(f.anna.Cookie, map[string]any{"userId": f.marco.ID, "reason": "harassment"})
	app.report(f.anna.Cookie, map[string]any{"listingId": f.listingID, "reason": "scam"})
	app.report(f.marco.Cookie, map[string]any{"userId": f.carla.ID, "reason": "spam"})

	var aboutMarco, aboutCarla int64
	for _, r := range app.adminReports(f.carla.Cookie, "").Items {
		if r.Target.ID == f.marco.ID && r.Listing == nil {
			aboutMarco = r.ID
		}
		if r.Target.ID == f.carla.ID {
			aboutCarla = r.ID
		}
	}
	expect(t, app.resolve(f.carla.Cookie, aboutCarla, "suspend_user"), http.StatusBadRequest, "cannot_suspend_admin")
	// Nemmeno un altro amministratore può sospenderla
	makeAdmin(t, f.anna)
	expect(t, app.resolve(f.anna.Cookie, aboutCarla, "suspend_user"), http.StatusBadRequest, "cannot_suspend_admin")
	testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET is_admin = false WHERE id = $1`, f.anna.ID)
	expect(t, app.resolve(f.carla.Cookie, aboutMarco, "suspend_user"), http.StatusNoContent, "")

	if app.session(f.marco.Cookie).User != nil || countSessions(t, f.marco.ID) != 0 {
		t.Errorf("le sessioni dell'account sospeso vanno chiuse: %d rimaste", countSessions(t, f.marco.ID))
	}
	rec := app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": f.marco.Email, "password": f.marco.Password})
	expect(t, rec, http.StatusForbidden, "account_suspended")
	// Con la password sbagliata la risposta è quella di sempre: la sospensione non si rivela
	rec = app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": f.marco.Email, "password": b64("sbagliata")})
	expect(t, rec, http.StatusUnauthorized, "invalid_credentials")

	expect(t, app.do(http.MethodGet, "/api/v1/users/"+f.marco.ID, nil, withSession(f.anna.Cookie)), http.StatusNotFound, "")
	if slices.Contains(roommateIDs(t, app, f.anna.Cookie), f.marco.ID) {
		t.Error("l'account sospeso non compare tra i coinquilini")
	}
	if slices.Contains(app.publicListingIDs(), f.listingID) {
		t.Error("gli annunci dell'account sospeso spariscono dall'elenco")
	}
	if _, status := app.listing(f.listingID, ""); status != http.StatusNotFound {
		t.Errorf("dettaglio dell'annuncio di un account sospeso: %d", status)
	}
	expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]any{"targetId": f.marco.ID}, withSession(f.carla.Cookie)), http.StatusNotFound, "")
	expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]any{"listingId": f.listingID}, withSession(f.carla.Cookie)),
		http.StatusNotFound, "listing_not_found")
	expect(t, app.do(http.MethodPost, "/api/v1/conversations/"+itoa(f.directChat)+"/messages", message("ci sei?", f.anna, f.marco),
		withSession(f.anna.Cookie)), http.StatusForbidden, "user_unavailable")
	if c := conversationByID(t, app, f.anna.Cookie, f.directChat); c.Other == nil || !c.Other.Unavailable {
		t.Errorf("la conversazione mostra l'altro come non disponibile: %+v", c.Other)
	}
	// Tutte le segnalazioni aperte su Marco si chiudono, anche quella sul suo annuncio
	for _, r := range app.adminReports(f.carla.Cookie, "").Items {
		if r.Target.ID == f.marco.ID {
			t.Errorf("segnalazione su Marco ancora aperta: %+v", r)
		}
	}

	// Riattivato, può accedere di nuovo e tutto torna visibile
	expect(t, app.do(http.MethodPost, "/api/v1/admin/users/"+f.marco.ID+"/unsuspend", nil, withSession(f.carla.Cookie)), http.StatusNoContent, "")
	expect(t, app.do(http.MethodPost, "/api/v1/admin/users/00000000-0000-0000-0000-000000000000/unsuspend", nil, withSession(f.carla.Cookie)),
		http.StatusNotFound, "")
	app.login(f.marco.Email, f.marco.Password)
	if !slices.Contains(app.publicListingIDs(), f.listingID) {
		t.Error("dopo la riattivazione l'annuncio torna visibile")
	}
}

// Il recupero dell'account non aggira la sospensione.
func TestSuspendedAccountCannotRecover(t *testing.T) {
	app := newApp(t)
	u := app.registerWithRecovery("Elio", "CODICE")
	testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET suspended_at = now() WHERE id = $1`, u.ID)
	expect(t, app.do(http.MethodPost, "/api/v1/auth/recovery/verify", recoveryProof(u.Email, "CODICE")), http.StatusForbidden, "account_suspended")
	expect(t, app.do(http.MethodPost, "/api/v1/auth/recovery/complete", completeRecovery(u.Email, "CODICE")), http.StatusForbidden, "account_suspended")
	// Con un codice sbagliato la risposta non cambia rispetto a un account qualsiasi
	expect(t, app.do(http.MethodPost, "/api/v1/auth/recovery/verify", recoveryProof(u.Email, "SBAGLIATO")), http.StatusUnauthorized, "")
}
