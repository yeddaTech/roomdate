package server_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"
)

type sessionItem struct {
	ID         string
	CreatedAt  time.Time
	LastUsedAt time.Time
	Device     string
	Current    bool
}

func (a *testApp) sessionList(cookie string) []sessionItem {
	a.t.Helper()
	rec := a.do(http.MethodGet, "/api/v1/me/sessions", nil, withSession(cookie))
	expect(a.t, rec, http.StatusOK, "")
	var body struct{ Items []sessionItem }
	decode(a.t, rec, &body)
	return body.Items
}

// hashOf calcola l'impronta del token come la salva il server.
func hashOf(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func countSessions(t *testing.T, userID string) int {
	t.Helper()
	var n int
	testPool.QueryRow(context.Background(), `SELECT count(*) FROM roomdate_app.sessions WHERE user_id = $1`, userID).Scan(&n)
	return n
}

// Il cookie contiene solo un numero casuale: nel database c'è la sua impronta, non il token.
func TestSessionTokenIsNotStored(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Anna", "cerca", false)

	var stored string
	err := testPool.QueryRow(context.Background(),
		`SELECT token_hash FROM roomdate_app.sessions WHERE user_id = $1`, u.ID).Scan(&stored)
	if err != nil {
		t.Fatal(err)
	}
	if stored == u.Cookie || stored != hashOf(u.Cookie) {
		t.Fatalf("nel database c'è %q per il token %q", stored, u.Cookie)
	}
	if len(u.Cookie) < 40 {
		t.Errorf("token troppo corto: %q", u.Cookie)
	}
}

func TestSessionExpiry(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Bruno", "affitta", false)
	ctx := context.Background()
	valid := func() bool {
		return app.session(u.Cookie).User != nil
	}
	// set modifica le date delle sessioni di un utente; un errore (es. un vincolo violato) ferma il
	// test, che altrimenti controllerebbe una sessione rimasta com'era
	set := func(userID, assignments string) {
		t.Helper()
		if _, err := testPool.Exec(ctx, `UPDATE roomdate_app.sessions SET `+assignments+` WHERE user_id = $1`, userID); err != nil {
			t.Fatal(err)
		}
	}

	if !valid() {
		t.Fatal("la sessione appena creata deve valere")
	}

	// Scadenza per inattività: la sessione esiste ma non viene usata da troppo tempo
	set(u.ID, `last_used_at = NOW() - interval '8 days'`)
	if valid() {
		t.Error("una sessione inattiva da 8 giorni non deve valere")
	}

	// Scadenza assoluta: usata di continuo, ma aperta troppo tempo fa
	set(u.ID, `created_at = NOW() - interval '31 days', last_used_at = NOW(), expires_at = NOW() - interval '1 minute'`)
	if valid() {
		t.Error("una sessione oltre la scadenza assoluta non deve valere")
	}

	// Una sessione scaduta non blocca il nuovo accesso, e le righe vecchie vengono ripulite
	cookie := app.login(u.Email, u.Password)
	if cookie == "" || countSessions(t, u.ID) != 1 {
		t.Errorf("sessioni dopo il nuovo accesso: %d", countSessions(t, u.ID))
	}

	// Anche le sessioni scadute di chi non torna più vanno via, al primo accesso di chiunque:
	// nessuna resta nel database oltre la scadenza assoluta
	other := app.registerUser("Carla", "cerca", false)
	set(other.ID, `created_at = NOW() - interval '31 days', last_used_at = NOW(), expires_at = NOW() - interval '1 minute'`)
	app.login(u.Email, u.Password)
	if countSessions(t, other.ID) != 0 {
		t.Errorf("sessioni scadute di un altro utente ancora presenti: %d", countSessions(t, other.ID))
	}
}

// L'utente vede i dispositivi collegati e può chiuderne l'accesso.
func TestSessionsCanBeRevoked(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Carla", "cerca", false)
	phone := app.login(u.Email, u.Password)

	sessions := app.sessionList(phone)
	if len(sessions) != 2 {
		t.Fatalf("sessioni = %+v", sessions)
	}
	current := 0
	for _, s := range sessions {
		if s.Current {
			current++
		}
		if s.Device == "" || s.ID == "" {
			t.Errorf("sessione senza dati: %+v", s)
		}
	}
	if current != 1 {
		t.Errorf("sessioni marcate come corrente: %d", current)
	}

	t.Run("revoca di una sessione", func(t *testing.T) {
		var other string
		for _, s := range sessions {
			if !s.Current {
				other = s.ID
			}
		}
		expect(t, app.do(http.MethodDelete, "/api/v1/me/sessions/"+other, nil), http.StatusUnauthorized, "")
		expect(t, app.do(http.MethodDelete, "/api/v1/me/sessions/"+other, nil, withSession(phone)), http.StatusNoContent, "")
		if app.session(u.Cookie).User != nil {
			t.Error("la sessione revocata non deve più valere")
		}
		if app.session(phone).User == nil {
			t.Error("la sessione corrente deve restare valida")
		}
	})

	t.Run("sessione di un altro utente", func(t *testing.T) {
		intruder := app.registerUser("Dario", "cerca", false)
		mine := app.sessionList(phone)[0].ID
		expect(t, app.do(http.MethodDelete, "/api/v1/me/sessions/"+mine, nil, withSession(intruder.Cookie)), http.StatusNotFound, "session_not_found")
		expect(t, app.do(http.MethodDelete, "/api/v1/me/sessions/non-un-id", nil, withSession(phone)), http.StatusNotFound, "")
		if app.session(phone).User == nil {
			t.Error("la sessione non doveva essere toccata")
		}
	})

	t.Run("esci dagli altri dispositivi", func(t *testing.T) {
		second := app.login(u.Email, u.Password)
		third := app.login(u.Email, u.Password)
		rec := app.do(http.MethodDelete, "/api/v1/me/sessions", nil, withSession(third))
		expect(t, rec, http.StatusOK, `"closed":2`)

		if app.session(third).User == nil {
			t.Error("la sessione da cui si chiude deve restare aperta")
		}
		for _, closed := range []string{phone, second} {
			if app.session(closed).User != nil {
				t.Error("le altre sessioni devono essere chiuse")
			}
		}
	})
}

// Cambiare password chiude gli altri accessi: è il modo di reagire a un furto di sessione.
func TestPasswordChangeRevokesOtherSessions(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Elena", "cerca", false)
	other := app.login(u.Email, u.Password)

	rec := app.do(http.MethodPost, "/api/v1/auth/password",
		map[string]any{"currentPassword": u.Password, "newPassword": b64("chiave-nuova-1"), "kdf": testKDF()}, withSession(u.Cookie))
	expect(t, rec, http.StatusNoContent, "")

	if app.session(other).User != nil {
		t.Error("l'altra sessione doveva essere chiusa")
	}
	if app.session(u.Cookie).User == nil {
		t.Error("la sessione da cui si cambia password resta aperta")
	}
}

func TestLogoutRevokesOnlyItsOwnSession(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Fabio", "cerca", false)
	other := app.login(u.Email, u.Password)

	expect(t, app.do(http.MethodPost, "/api/v1/auth/logout", nil, withSession(u.Cookie)), http.StatusNoContent, "")
	if app.session(u.Cookie).User != nil {
		t.Error("dopo l'uscita la sessione non deve più valere")
	}
	if app.session(other).User == nil {
		t.Error("le altre sessioni restano aperte")
	}
	if n := countSessions(t, u.ID); n != 1 {
		t.Errorf("sessioni rimaste: %d", n)
	}
}

// Gli account registrati con bcrypt passano ad Argon2id al primo accesso, senza che l'utente se ne accorga.
func TestLegacyPasswordHashIsUpgraded(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Gino", "cerca", false)
	ctx := context.Background()
	// Hash bcrypt di "password-di-prova", come li generava la versione precedente
	const bcryptHash = "$2a$10$zcgbUGI86/Ags373qHkHb.OnDKEiS/Uxmc1G8OLwzGcLOz7gS9.Vu"
	if _, err := testPool.Exec(ctx, `UPDATE roomdate_app.users SET password_hash = $2 WHERE id = $1`, u.ID, bcryptHash); err != nil {
		t.Fatal(err)
	}

	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": u.Email, "password": "password-di-prova"}), http.StatusOK, "")

	var stored string
	testPool.QueryRow(ctx, `SELECT password_hash FROM roomdate_app.users WHERE id = $1`, u.ID).Scan(&stored)
	if !strings.HasPrefix(stored, "$argon2id$") {
		t.Fatalf("hash dopo l'accesso = %q", stored)
	}
	// La password non cambia: si accede ancora con la stessa
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": u.Email, "password": "password-di-prova"}), http.StatusOK, "")
}

// Il registro di sicurezza tiene traccia di accessi e operazioni delicate, senza salvare
// email e indirizzi IP in chiaro.
func TestSecurityEvents(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Ilaria", "cerca", false)
	app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": u.Email, "password": "sbagliata"})
	expect(t, app.do(http.MethodPost, "/api/v1/auth/password",
		map[string]any{"currentPassword": u.Password, "newPassword": b64("chiave-nuova-2"), "kdf": testKDF()}, withSession(u.Cookie)), http.StatusNoContent, "")

	rows, err := testPool.Query(context.Background(),
		`SELECT kind, COALESCE(email_hash, ''), COALESCE(ip_hash, '') FROM roomdate_app.security_events ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	var kinds []string
	for rows.Next() {
		var kind, emailHash, ipHash string
		if err := rows.Scan(&kind, &emailHash, &ipHash); err != nil {
			t.Fatal(err)
		}
		kinds = append(kinds, kind)
		if strings.Contains(emailHash, "@") || strings.Contains(ipHash, ".") {
			t.Errorf("il registro contiene dati in chiaro: %q, %q", emailHash, ipHash)
		}
	}
	if !slices.Equal(kinds, []string{"login_ok", "login_failed", "password_changed"}) {
		t.Fatalf("eventi registrati = %v", kinds)
	}
}

// Gli eventi più vecchi di 90 giorni vengono cancellati, come dichiara l'informativa privacy.
func TestOldSecurityEventsAreDeleted(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Lara", "cerca", false)
	ctx := context.Background()
	if _, err := testPool.Exec(ctx, `
        INSERT INTO roomdate_app.security_events (kind, user_id, created_at) VALUES
            ('login_ok', $1, NOW() - interval '91 days'),
            ('login_ok', $1, NOW() - interval '89 days')`, u.ID); err != nil {
		t.Fatal(err)
	}

	app.login(u.Email, u.Password)

	var old, recent int
	testPool.QueryRow(ctx, `SELECT count(*) FILTER (WHERE created_at < NOW() - interval '90 days'),
                                   count(*) FILTER (WHERE created_at > NOW() - interval '90 days')
                            FROM roomdate_app.security_events`).Scan(&old, &recent)
	if old != 0 || recent < 2 {
		t.Fatalf("eventi vecchi rimasti: %d, recenti: %d", old, recent)
	}
}
