package server_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"
)

// Modulo M3.3: età minima, profili privati, cancellazione verificata ed esportazione dei dati.

func TestMinimumAge(t *testing.T) {
	app := newApp(t)
	// Lo stesso orologio del server (time.Now nel fuso del processo): con UTC, tra mezzanotte e le
	// 2 in Italia il test e il server vedrebbero due giorni diversi e il test fallirebbe
	today := time.Now()
	// Il giorno esatto del compleanno (anche il 29 febbraio) lo verifica TestAgeAtLeast
	minor := today.AddDate(-18, 0, 1).Format(time.DateOnly)  // compie 18 anni domani
	adult := today.AddDate(-18, 0, -1).Format(time.DateOnly) // li ha compiuti ieri

	body := registration("Ugo", "ugo@test.it", testPassword, "cerca", false)
	body["birthdate"] = minor
	expect(t, app.do(http.MethodPost, "/api/v1/auth/register", body), http.StatusBadRequest, "almeno 18 anni")
	body["birthdate"] = adult
	expect(t, app.do(http.MethodPost, "/api/v1/auth/register", body), http.StatusCreated, "")

	u := app.registerUser("Vera", "cerca", false)
	profile := map[string]any{"userType": "cerca", "city": "Milano", "budgetMax": 400, "birthdate": minor, "isPublic": true}
	expect(t, app.do(http.MethodPut, "/api/v1/me", profile, withSession(u.Cookie)), http.StatusBadRequest, "almeno 18 anni")
}

// Un profilo privato non si può contattare da zero, ma una conversazione già avviata continua.
func TestPrivateProfileDirectChat(t *testing.T) {
	app := newApp(t)
	anna := app.registerUser("Anna", "cerca", true)
	bruno := app.registerUser("Bruno", "cerca", true)
	carla := app.registerUser("Carla", "cerca", true)
	existing := app.startChat(anna.Cookie, map[string]any{"targetId": bruno.ID})

	testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET is_public = false WHERE id = $1`, bruno.ID)
	expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]any{"targetId": bruno.ID}, withSession(carla.Cookie)),
		http.StatusNotFound, "user_not_found")
	if again := app.startChat(anna.Cookie, map[string]any{"targetId": bruno.ID}); again != existing {
		t.Errorf("la conversazione già avviata si riapre: %d, attesa %d", again, existing)
	}
	app.send(anna.Cookie, existing, message("ci sei ancora?", anna, bruno))
	// Chi ha il profilo privato può comunque scrivere a chi vuole
	app.startChat(bruno.Cookie, map[string]any{"targetId": carla.ID})
}

// Cosa resta e cosa sparisce quando un utente elimina l'account (anomalia F16, GDPR).
func TestAccountDeletionRemovesPersonalData(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	ctx := context.Background()
	app.send(f.anna.Cookie, f.directChat, message("ciao", f.anna, f.marco))
	// Una conversazione in cui l'altra partecipante elimina l'account per prima
	app.startChat(f.anna.Cookie, map[string]any{"targetId": f.carla.ID})
	expect(t, app.block(f.anna.Cookie, f.carla.ID), http.StatusNoContent, "")
	expect(t, app.block(f.carla.Cookie, f.anna.ID), http.StatusNoContent, "")
	expect(t, app.report(f.anna.Cookie, map[string]any{"userId": f.marco.ID}), http.StatusCreated, "")
	expect(t, app.report(f.carla.Cookie, map[string]any{"userId": f.anna.ID}), http.StatusCreated, "")

	count := func(query string, args ...any) int {
		t.Helper()
		var n int
		if err := testPool.QueryRow(ctx, query, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	// Carla elimina l'account: resta la conversazione con Anna, che la può ancora leggere
	expect(t, app.do(http.MethodDelete, "/api/v1/me", map[string]string{"password": f.carla.Password}, withSession(f.carla.Cookie)), http.StatusNoContent, "")
	conversationsBefore := count(`SELECT count(*) FROM roomdate_app.conversations`)

	expect(t, app.do(http.MethodDelete, "/api/v1/me", map[string]string{"password": f.anna.Password}, withSession(f.anna.Cookie)), http.StatusNoContent, "")

	for what, n := range map[string]int{
		"account":                     count(`SELECT count(*) FROM roomdate_app.users WHERE id = $1`, f.anna.ID),
		"sessioni":                    count(`SELECT count(*) FROM roomdate_app.sessions WHERE user_id = $1`, f.anna.ID),
		"blocchi":                     count(`SELECT count(*) FROM roomdate_app.user_blocks`),
		"segnalazioni ricevute":       count(`SELECT count(*) FROM roomdate_app.reports WHERE target_user_id = $1`, f.anna.ID),
		"eventi collegati all'utente": count(`SELECT count(*) FROM roomdate_app.security_events WHERE user_id = $1`, f.anna.ID),
		// La conversazione tra Anna e Carla non ha più partecipanti: sparisce con i messaggi
		"conversazioni senza partecipanti": count(`
            SELECT count(*) FROM roomdate_app.conversations c
            WHERE NOT EXISTS (SELECT 1 FROM roomdate_app.conversation_participants p WHERE p.conversation_id = c.id)`),
	} {
		if n != 0 {
			t.Errorf("%s rimasti dopo l'eliminazione: %d", what, n)
		}
	}
	if after := count(`SELECT count(*) FROM roomdate_app.conversations`); after != conversationsBefore-1 {
		t.Errorf("conversazioni: %d prima, %d dopo (attesa una in meno)", conversationsBefore, after)
	}
	// La segnalazione fatta da Anna resta ai moderatori, senza autore
	if n := count(`SELECT count(*) FROM roomdate_app.reports WHERE target_user_id = $1 AND reporter_id IS NULL`, f.marco.ID); n != 1 {
		t.Errorf("segnalazione di Anna su Marco, senza autore: %d", n)
	}
	// Marco conserva le sue conversazioni con i messaggi ricevuti
	if msgs := app.messages(f.marco.Cookie, f.directChat, "").Items; len(msgs) != 1 || msgs[0].SenderID != "" {
		t.Errorf("messaggi di Marco dopo l'eliminazione di Anna: %+v", msgs)
	}
}

func TestExport(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	app.uploadImage(f.marco.Cookie, f.listingID, "image/jpeg", jpegBytes(100))
	app.send(f.anna.Cookie, f.directChat, message("ciao", f.anna, f.marco))
	app.block(f.marco.Cookie, f.carla.ID)
	evidence := []map[string]any{{"text": "messaggio allegato", "sentAt": "2026-09-20T18:30:00Z"}}
	app.report(f.marco.Cookie, map[string]any{"userId": f.anna.ID, "conversationId": f.directChat, "evidence": evidence})
	app.report(f.carla.Cookie, map[string]any{"userId": f.marco.ID, "reason": "spam", "details": "testo di Carla"})

	expect(t, app.do(http.MethodGet, "/api/v1/me/export", nil), http.StatusUnauthorized, "")
	rec := app.do(http.MethodGet, "/api/v1/me/export", nil, withSession(f.marco.Cookie))
	expect(t, rec, http.StatusOK, "")

	var export struct {
		About   string
		Account struct {
			ID, Email, FirstName, Birthdate, PublicKey string
			CreatedAt                                  *time.Time
		}
		Listings []struct {
			ID     int
			Title  string
			Photos []string
		}
		Conversations []struct {
			ID    int
			Other string
		}
		Sessions       []struct{ Device string }
		SecurityEvents []struct{ Kind string }
		Blocks         []struct{ UserID, FirstName string }
		Reports        []struct {
			ReportedUserID string
			Reason         string
			Evidence       []struct{ Text string }
		}
		ReportsAboutMe []map[string]any
	}
	decode(t, rec, &export)
	if export.Account.ID != f.marco.ID || export.Account.Email != f.marco.Email || export.Account.Birthdate != "1999-01-01" ||
		export.Account.CreatedAt == nil || export.Account.PublicKey == "" || export.About == "" {
		t.Errorf("account = %+v", export.Account)
	}
	if len(export.Listings) != 1 || export.Listings[0].ID != f.listingID || len(export.Listings[0].Photos) != 1 ||
		!strings.HasPrefix(export.Listings[0].Photos[0], "https://img.test/") {
		t.Errorf("annunci = %+v", export.Listings)
	}
	if len(export.Conversations) != 2 || export.Conversations[0].Other != "Anna" {
		t.Errorf("conversazioni = %+v", export.Conversations)
	}
	if len(export.Sessions) != 1 || len(export.SecurityEvents) == 0 {
		t.Errorf("sessioni = %+v, eventi = %+v", export.Sessions, export.SecurityEvents)
	}
	if len(export.Blocks) != 1 || export.Blocks[0].FirstName != "Carla" {
		t.Errorf("blocchi = %+v", export.Blocks)
	}
	if len(export.Reports) != 1 || export.Reports[0].ReportedUserID != f.anna.ID || len(export.Reports[0].Evidence) != 1 ||
		export.Reports[0].Evidence[0].Text != "messaggio allegato" {
		t.Errorf("segnalazioni inviate = %+v", export.Reports)
	}
	// Le segnalazioni ricevute non dicono chi le ha fatte né cosa ha scritto
	if len(export.ReportsAboutMe) != 1 || export.ReportsAboutMe[0]["reason"] != "spam" {
		t.Errorf("segnalazioni ricevute = %+v", export.ReportsAboutMe)
	}

	// Niente segreti né dati personali di altri utenti
	raw := rec.Body.String()
	for _, secret := range []string{"password", "argon2", "VAULT-", "token", "Hash", "hash", "testo di Carla", f.anna.Email, f.carla.Email} {
		if strings.Contains(raw, secret) {
			t.Errorf("l'esportazione contiene %q", secret)
		}
	}

	// Un utente senza nulla riceve elenchi vuoti, non null
	empty := app.registerUser("Zeno", "cerca", false)
	rec = app.do(http.MethodGet, "/api/v1/me/export", nil, withSession(empty.Cookie))
	var generic map[string]json.RawMessage
	decode(t, rec, &generic)
	for _, key := range []string{"listings", "conversations", "blocks", "reports", "reportsAboutMe", "securityEvents", "sessions"} {
		if !strings.HasPrefix(string(generic[key]), "[") {
			t.Errorf("%s = %s, atteso un elenco", key, generic[key])
		}
	}
}
