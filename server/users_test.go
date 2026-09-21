package server_test

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

type sessionResponse struct {
	User *struct {
		ID, FirstName, LastName, Email, UserType string
	}
}

func (a *testApp) session(cookie string) sessionResponse {
	a.t.Helper()
	rec := a.do(http.MethodGet, "/api/v1/auth/session", nil, withSession(cookie))
	expect(a.t, rec, http.StatusOK, "")
	var body sessionResponse
	decode(a.t, rec, &body)
	return body
}

func TestRegisterAndLogin(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Anna", "cerca", true)

	t.Run("login restituisce utente e chiavi", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": u.Email, "password": u.Password})
		expect(t, rec, http.StatusOK, "")
		var body struct {
			User struct{ ID, FirstName, Email, UserType string }
			Keys *struct{ PublicKey, EncryptedPrivateKey, CryptoSalt, CryptoIv string }
		}
		decode(t, rec, &body)
		if body.User.ID != u.ID || body.User.FirstName != "Anna" || body.User.Email != u.Email || body.User.UserType != "cerca" {
			t.Errorf("user = %+v", body.User)
		}
		if body.Keys == nil || body.Keys.EncryptedPrivateKey != b64("VAULT-Anna") || body.Keys.PublicKey != b64("PUB-Anna") || body.Keys.CryptoIv != b64("IV") {
			t.Errorf("keys = %+v", body.Keys)
		}
		cookie := rec.Result().Cookies()[0]
		if cookie.Name != sessionCookieName || !cookie.HttpOnly || !cookie.Secure {
			t.Errorf("cookie = %+v", cookie)
		}
	})

	t.Run("account senza chiavi: keys è null", func(t *testing.T) {
		bruno := app.registerUser("Bruno", "affitta", false)
		rec := app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": bruno.Email, "password": bruno.Password})
		expect(t, rec, http.StatusOK, `"keys":null`)
	})

	t.Run("sessione", func(t *testing.T) {
		if s := app.session(u.Cookie); s.User == nil || s.User.ID != u.ID || s.User.LastName != "Rossi" {
			t.Fatalf("sessione = %+v", s.User)
		}
		if s := app.session(""); s.User != nil {
			t.Fatal("senza cookie non c'è sessione")
		}
		rec := app.do(http.MethodGet, "/api/v1/auth/session", nil, withSession("token.falso.x"))
		expect(t, rec, http.StatusOK, `{"user":null}`)
		if !strings.Contains(rec.Header().Get("Set-Cookie"), "Max-Age=0") {
			t.Error("un cookie non valido va cancellato")
		}
	})

	t.Run("credenziali errate", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": u.Email, "password": "sbagliata"}), http.StatusUnauthorized, `"code":"invalid_credentials"`)
		expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": "nessuno@test.it", "password": "x"}), http.StatusUnauthorized, "invalid_credentials")
	})

	t.Run("email già registrata", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/v1/auth/register", registration("Altra", u.Email, testPassword, "cerca", false))
		expect(t, rec, http.StatusConflict, "Impossibile completare la registrazione")
		expectNoLeak(t, rec)
	})
}

func TestRegisterValidation(t *testing.T) {
	app := newApp(t)
	cases := []struct {
		name, field string
		value       any
		message     string
	}{
		{"nome vuoto", "firstName", "   ", "Il nome è obbligatorio"},
		{"nome solo caratteri invisibili", "firstName", "\x00\x07 ", "Il nome è obbligatorio"},
		{"email non valida", "email", "bruno", "Inserisci un indirizzo email valido"},
		{"chiave di accesso non valida", "password", "non-base64!", "Chiave di accesso non valida"},
		{"chiave di accesso vuota", "password", "", "Chiave di accesso non valida"},
		{"chiave di accesso troppo lunga", "password", b64(strings.Repeat("x", 200)), "Chiave di accesso non valida"},
		{"parametri di sicurezza assenti", "kdf", nil, "Aggiorna la pagina"},
		{"metodo di derivazione vecchio", "kdf", map[string]any{"version": 1}, "Aggiorna la pagina"},
		{"sale troppo corto", "kdf", map[string]any{"version": 2, "salt": b64("x"), "iterations": 600000}, "Parametri di sicurezza"},
		{"ripetizioni insufficienti", "kdf", map[string]any{"version": 2, "salt": b64("sale-di-prova-1234"), "iterations": 1000}, "Parametri di sicurezza"},
		{"tipo utente sconosciuto", "userType", "admin", "Tipo di utente non valido"},
		{"data di nascita vuota", "birthdate", "", "Data di nascita non valida"},
		{"data di nascita futura", "birthdate", "2999-01-01", "Data di nascita non valida"},
		{"budget negativo", "budgetMax", -1, "budget"},
		{"bio troppo lunga", "bio", strings.Repeat("a", 1001), "bio"},
		{"città fuori elenco", "city", "Gotham", "Scegli la città dall'elenco"},
		{"città con maiuscole diverse", "city", "MILANO", "Scegli la città dall'elenco"},
		{"occupazione come etichetta", "occupation", "Studente", "Occupazione non valida"},
		{"abitudine sconosciuta", "lifestyleTags", []string{"socievole", "sportivo"}, "Abitudine non valida"},
		{"fumatore e non fumatore", "lifestyleTags", []string{"fumatore", "non_fumatore"}, "Scegli solo una"},
		{"chiavi incomplete", "keys", map[string]string{"publicKey": b64("solo-la-pubblica")}, "Chiavi di cifratura non valide"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			body := registration("Bruno", "bruno@test.it", testPassword, "affitta", false)
			body[c.field] = c.value
			rec := app.do(http.MethodPost, "/api/v1/auth/register", body)
			expect(t, rec, http.StatusBadRequest, c.message)
			expect(t, rec, http.StatusBadRequest, `"field":"`+c.field+`"`)
		})
	}

	t.Run("i dati validi passano", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/v1/auth/register", registration("Bruno", "bruno@test.it", testPassword, "affitta", false)), http.StatusCreated, `"id":`)
	})

	t.Run("città, occupazione e abitudini sono facoltative", func(t *testing.T) {
		body := registration("Carla", "carla@test.it", testPassword, "cerca", false)
		body["city"], body["occupation"], body["lifestyleTags"] = "", "", nil
		expect(t, app.do(http.MethodPost, "/api/v1/auth/register", body), http.StatusCreated, "")
		cookie := app.login("carla@test.it", testPassword)
		expect(t, app.do(http.MethodGet, "/api/v1/me", nil, withSession(cookie)), http.StatusOK, `"city":"","birthdate":"1999-01-01","budgetMax":500,"occupation":"","bio":"ciao","lifestyleTags":[]`)
		var nulls int
		testPool.QueryRow(context.Background(), `SELECT count(*) FROM roomdate_app.users WHERE email = 'carla@test.it' AND citta IS NULL AND occupation IS NULL`).Scan(&nulls)
		if nulls != 1 {
			t.Error("città e occupazione vuote vanno salvate come NULL")
		}
	})
}

// Anomalia F2: l'email non distingue maiuscole e minuscole, né in registrazione né al login.
func TestEmailIsCaseInsensitive(t *testing.T) {
	app := newApp(t)
	body := registration("Anna", "  Anna.Rossi@Test.IT ", testPassword, "cerca", false)
	expect(t, app.do(http.MethodPost, "/api/v1/auth/register", body), http.StatusCreated, "")

	cookie := app.login("ANNA.ROSSI@test.it", testPassword)
	expect(t, app.do(http.MethodGet, "/api/v1/me", nil, withSession(cookie)), http.StatusOK, `"email":"anna.rossi@test.it"`)

	rec := app.do(http.MethodPost, "/api/v1/auth/register", registration("Anna", "anna.rossi@test.IT", b64("altra-chiave"), "cerca", false))
	expect(t, rec, http.StatusConflict, "registration_failed")

	// Anche fuori dall'API il database accetta solo indirizzi in minuscolo (vincolo di M3.6), e
	// ciascuno una volta sola: ogni prova deve fallire per il motivo atteso
	for email, code := range map[string]string{
		"ANNA.ROSSI@TEST.IT": "23514", // check_violation: maiuscole
		"anna.rossi@test.it": "23505", // unique_violation: doppione
	} {
		_, err := testPool.Exec(context.Background(), `INSERT INTO roomdate_app.users (email, password_hash) VALUES ($1, 'x')`, email)
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != code {
			t.Errorf("inserimento di %q: errore %v, atteso il codice %s", email, err, code)
		}
	}
}

// Dopo qualche tentativo fallito bisogna aspettare, ma l'account non si blocca: chiunque conosca
// un indirizzo email potrebbe altrimenti chiudere fuori quella persona.
func TestLoginThrottling(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Carla", "cerca", false)
	login := func(email, password string) map[string]string {
		return map[string]string{"email": email, "password": password}
	}

	for i := 1; i < 5; i++ {
		expect(t, app.do(http.MethodPost, "/api/v1/auth/login", login(u.Email, "no")), http.StatusUnauthorized, "Credenziali non valide")
	}
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", login(u.Email, "no")), http.StatusUnauthorized, "")
	rec := app.do(http.MethodPost, "/api/v1/auth/login", login(u.Email, u.Password))
	expect(t, rec, http.StatusTooManyRequests, "Troppi tentativi")

	// Passata l'attesa si rientra: i tentativi contano solo se recenti
	if _, err := testPool.Exec(context.Background(),
		`UPDATE roomdate_app.security_events SET created_at = NOW() - interval '30 minutes'`); err != nil {
		t.Fatal(err)
	}
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", login(u.Email, u.Password)), http.StatusOK, "")
}

// Chi prova un indirizzo inesistente riceve la stessa risposta di chi sbaglia la password:
// dalle risposte non si capisce quali email sono registrate.
func TestLoginDoesNotRevealRegisteredEmails(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Dino", "cerca", false)

	unknown := app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": "nessuno@test.it", "password": "una-password-qualsiasi"})
	wrong := app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": u.Email, "password": "una-password-qualsiasi"})
	expect(t, unknown, http.StatusUnauthorized, "Credenziali non valide")
	expect(t, wrong, http.StatusUnauthorized, "Credenziali non valide")
	if unknown.Body.String() != wrong.Body.String() {
		t.Fatalf("risposte diverse: %s e %s", unknown.Body.String(), wrong.Body.String())
	}
}

func TestLogoutClearsCookie(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Dario", "cerca", false)

	rec := app.do(http.MethodPost, "/api/v1/auth/logout", nil, withSession(u.Cookie))
	expect(t, rec, http.StatusNoContent, "")
	header := rec.Header().Get("Set-Cookie")
	if !strings.Contains(header, "roomdate_session=;") || !strings.Contains(header, "Max-Age=0") {
		t.Fatalf("Set-Cookie = %q", header)
	}
}

var newTestPassword = b64("nuova-chiave-di-accesso")

func TestChangePassword(t *testing.T) {
	app := newApp(t)
	anna := app.registerUser("Anna", "cerca", true)
	bruno := app.registerUser("Bruno", "affitta", false)

	// changePassword costruisce la richiesta; withKeys aggiunge la chiave privata cifrata di nuovo
	changePassword := func(current, next string, withKeys bool) map[string]any {
		body := map[string]any{"currentPassword": current, "newPassword": next, "kdf": testKDF()}
		if withKeys {
			body["keys"] = map[string]string{"encryptedPrivateKey": b64("VAULT-NEW"), "cryptoSalt": b64("SALT-NEW"), "cryptoIv": b64("IV-NEW")}
		}
		return body
	}
	vaultOf := func(id string) string {
		var vault string
		testPool.QueryRow(context.Background(), `SELECT COALESCE(encrypted_private_key, '') FROM roomdate_app.users WHERE id = $1`, id).Scan(&vault)
		return vault
	}
	const path = "/api/v1/auth/password"

	expect(t, app.do(http.MethodPost, path, changePassword(anna.Password, newTestPassword, true)), http.StatusUnauthorized, "session_invalid")
	expect(t, app.do(http.MethodPost, path, changePassword(anna.Password, "non-base64!", true), withSession(anna.Cookie)), http.StatusBadRequest, "Chiave di accesso non valida")
	expect(t, app.do(http.MethodPost, path, changePassword(anna.Password, newTestPassword, false), withSession(anna.Cookie)), http.StatusBadRequest, "Chiavi di cifratura mancanti")
	// Password attuale errata: codice invalid_credentials, che il frontend non scambia per una sessione scaduta
	expect(t, app.do(http.MethodPost, path, changePassword("sbagliata", newTestPassword, true), withSession(anna.Cookie)), http.StatusUnauthorized, `"code":"invalid_credentials"`)
	if vaultOf(anna.ID) != b64("VAULT-Anna") {
		t.Fatal("la chiave non deve cambiare dopo un errore")
	}

	expect(t, app.do(http.MethodPost, path, changePassword(anna.Password, newTestPassword, true), withSession(anna.Cookie)), http.StatusNoContent, "")
	if vaultOf(anna.ID) != b64("VAULT-NEW") {
		t.Fatal("la chiave privata deve cambiare insieme alla password")
	}
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": anna.Email, "password": anna.Password}), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": anna.Email, "password": newTestPassword}), http.StatusOK, b64("VAULT-NEW"))

	// Utente senza chiavi: nessuna chiave richiesta e nessuna chiave aggiunta
	expect(t, app.do(http.MethodPost, path, changePassword(bruno.Password, b64("nebbia-sul-lago"), true), withSession(bruno.Cookie)), http.StatusNoContent, "")
	if vaultOf(bruno.ID) != "" {
		t.Fatal("non va aggiunta una chiave a un utente che non l'aveva")
	}
}

func TestDeleteAccount(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Elena", "cerca", false)

	expect(t, app.do(http.MethodDelete, "/api/v1/me", map[string]string{"password": u.Password}), http.StatusUnauthorized, "")
	// Serve la password: una sessione lasciata aperta non basta a cancellare un account
	expect(t, app.do(http.MethodDelete, "/api/v1/me", map[string]string{"password": "sbagliata"}, withSession(u.Cookie)), http.StatusUnauthorized, "La password non è corretta")
	expect(t, app.do(http.MethodDelete, "/api/v1/me", nil, withSession(u.Cookie)), http.StatusUnauthorized, "")

	rec := app.do(http.MethodDelete, "/api/v1/me", map[string]string{"password": u.Password}, withSession(u.Cookie))
	expect(t, rec, http.StatusNoContent, "")
	if !strings.Contains(rec.Header().Get("Set-Cookie"), "Max-Age=0") {
		t.Error("il cookie di sessione va cancellato")
	}
	// Il vecchio cookie è ancora firmato correttamente, ma l'utente non esiste più
	if s := app.session(u.Cookie); s.User != nil {
		t.Fatal("la sessione di un utente eliminato non è valida")
	}
}

// Eliminare un account con annunci, foto e conversazioni funziona (F16): annunci e foto spariscono,
// le conversazioni restano all'altro partecipante con "Utente eliminato".
func TestDeleteAccountWithListingsAndChats(t *testing.T) {
	app := newApp(t)
	landlord := app.registerUser("Marco", "affitta", true)
	seeker := app.registerUser("Giulia", "cerca", true)
	listingID := app.createListing(landlord.Cookie, nil)
	imageKey := app.uploadImage(landlord.Cookie, listingID, "image/jpeg", jpegBytes(100))

	conversationID := app.startChat(seeker.Cookie, map[string]any{"listingId": listingID})
	app.send(seeker.Cookie, conversationID, message("domanda", seeker, landlord))
	app.send(landlord.Cookie, conversationID, message("risposta", seeker, landlord))

	expect(t, app.do(http.MethodDelete, "/api/v1/me", map[string]string{"password": landlord.Password}, withSession(landlord.Cookie)), http.StatusNoContent, "")

	if _, code := app.listing(listingID, ""); code != http.StatusNotFound {
		t.Errorf("annuncio dell'account eliminato ancora visibile: %d", code)
	}
	for _, key := range app.storage.keys() {
		if key == imageKey {
			t.Error("foto dell'account eliminato rimasta nello storage")
		}
	}

	// La conversazione resta a chi c'è ancora: l'altro partecipante non esiste più
	chats := app.conversations(seeker.Cookie)
	if len(chats) != 1 || chats[0].Other != nil || chats[0].UnreadCount != 1 {
		t.Fatalf("chat dopo l'eliminazione = %+v", chats)
	}
	received := app.messages(seeker.Cookie, conversationID, "").Items
	if len(received) != 2 || received[0].Body != b64("risposta") || received[0].SenderID != "" ||
		received[0].Key != b64("chiave-per-"+seeker.ID) {
		t.Fatalf("messaggi dopo l'eliminazione = %+v", received)
	}

	// Le chiavi dei messaggi dell'utente eliminato non servono più a nessuno e spariscono
	var leftovers int
	testPool.QueryRow(context.Background(), `
        SELECT count(*) FROM roomdate_app.message_keys k
        LEFT JOIN roomdate_app.users u ON u.id = k.user_id WHERE u.id IS NULL`).Scan(&leftovers)
	if leftovers != 0 {
		t.Errorf("chiavi dei messaggi dell'account eliminato rimaste: %d", leftovers)
	}
	testPool.QueryRow(context.Background(), `
        SELECT count(*) FROM roomdate_app.conversation_participants p
        LEFT JOIN roomdate_app.users u ON u.id = p.user_id WHERE u.id IS NULL`).Scan(&leftovers)
	if leftovers != 0 {
		t.Errorf("partecipanti eliminati rimasti: %d", leftovers)
	}
}

func TestProfilePrivacy(t *testing.T) {
	app := newApp(t)
	anna := app.registerUser("Anna", "cerca", false)
	bruno := app.registerUser("Bruno", "affitta", false)
	carla := app.registerUser("Carla", "cerca", false)
	testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET is_public = false WHERE id = $1`, carla.ID)

	t.Run("profilo altrui: solo dati pubblici", func(t *testing.T) {
		for _, cookie := range []string{"", bruno.Cookie} {
			rec := app.do(http.MethodGet, "/api/v1/users/"+anna.ID, nil, withSession(cookie))
			expect(t, rec, http.StatusOK, `"firstName":"Anna"`)
			var body map[string]any
			decode(t, rec, &body)
			for _, private := range []string{"email", "lastName", "birthdate", "isPublic"} {
				if _, found := body[private]; found {
					t.Errorf("il profilo pubblico contiene %q", private)
				}
			}
		}
	})

	t.Run("profilo proprio: completo", func(t *testing.T) {
		expect(t, app.do(http.MethodGet, "/api/v1/me", nil, withSession(anna.Cookie)), http.StatusOK, `"email":"anna@test.it"`)
		expect(t, app.do(http.MethodGet, "/api/v1/me", nil, withSession(carla.Cookie)), http.StatusOK, `"isPublic":false`)
		expect(t, app.do(http.MethodGet, "/api/v1/me", nil), http.StatusUnauthorized, `"code":"session_invalid"`)
	})

	t.Run("profilo privato o inesistente", func(t *testing.T) {
		expect(t, app.do(http.MethodGet, "/api/v1/users/"+carla.ID, nil, withSession(anna.Cookie)), http.StatusNotFound, `"code":"user_not_found"`)
		expect(t, app.do(http.MethodGet, "/api/v1/users/"+carla.ID, nil), http.StatusNotFound, "")
		expect(t, app.do(http.MethodGet, "/api/v1/users/99999", nil), http.StatusNotFound, "")
		expect(t, app.do(http.MethodGet, "/api/v1/users/abc", nil), http.StatusNotFound, "")
		// Il proprietario vede il proprio profilo pubblico anche se è privato
		expect(t, app.do(http.MethodGet, "/api/v1/users/"+carla.ID, nil, withSession(carla.Cookie)), http.StatusOK, `"firstName":"Carla"`)
	})

	t.Run("età al posto della data di nascita", func(t *testing.T) {
		// Compleanno oggi: anni compiuti. Compleanno domani: un anno in meno.
		testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET birthdate = CURRENT_DATE - interval '30 years' WHERE id = $1`, anna.ID)
		testPool.Exec(context.Background(), `UPDATE roomdate_app.users SET birthdate = CURRENT_DATE - interval '30 years' + interval '1 day' WHERE id = $1`, bruno.ID)
		expect(t, app.do(http.MethodGet, "/api/v1/users/"+anna.ID, nil), http.StatusOK, `"age":30,`)
		expect(t, app.do(http.MethodGet, "/api/v1/users/"+bruno.ID, nil), http.StatusOK, `"age":29,`)
	})

	t.Run("compatibilità solo per chi ha una sessione e guarda un altro profilo", func(t *testing.T) {
		expect(t, app.do(http.MethodGet, "/api/v1/users/"+anna.ID, nil), http.StatusOK, `"compatibility":null`)
		expect(t, app.do(http.MethodGet, "/api/v1/users/"+anna.ID, nil, withSession(anna.Cookie)), http.StatusOK, `"compatibility":null`)
		expect(t, app.do(http.MethodGet, "/api/v1/users/"+anna.ID, nil, withSession(bruno.Cookie)), http.StatusOK,
			`"compatibility":{"sameCity":true,"similarBudget":true,"sharedTags":["socievole"],"smokingMismatch":false}`)
	})
}

func profileInput(fields map[string]any) map[string]any {
	body := map[string]any{
		"userType": "cerca", "city": "Milano", "budgetMax": 650, "occupation": "studente",
		"birthdate": "1999-04-12", "bio": "ciao", "lifestyleTags": []string{"socievole"}, "isPublic": true,
	}
	for k, v := range fields {
		body[k] = v
	}
	return body
}

func TestUpdateProfile(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Giulia", "cerca", false)

	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(nil)), http.StatusUnauthorized, "")

	bio := `Cerco un'amica & <b>coinquilina</b> "tranquilla"`
	rec := app.do(http.MethodPut, "/api/v1/me", profileInput(map[string]any{"bio": bio, "budgetMax": 700}), withSession(u.Cookie))
	expect(t, rec, http.StatusOK, "")
	var profile struct {
		Bio       string
		BudgetMax int
		Email     string
	}
	decode(t, rec, &profile)
	// Il testo si salva così com'è, compresi i caratteri HTML: React fa l'escape quando lo mostra
	if profile.Bio != bio || profile.BudgetMax != 700 || profile.Email != u.Email {
		t.Fatalf("profilo restituito = %s", rec.Body.String())
	}

	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(map[string]any{"budgetMax": "tanti"}), withSession(u.Cookie)), http.StatusBadRequest, "Dati non validi")
	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(map[string]any{"userType": "admin"}), withSession(u.Cookie)), http.StatusBadRequest, "Tipo di utente")
	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(map[string]any{"birthdate": ""}), withSession(u.Cookie)), http.StatusBadRequest, `"field":"birthdate"`)
	// Il vecchio formato delle abitudini (testo separato da virgole) non è più accettato
	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(map[string]any{"lifestyleTags": "Socievole, Ordinato/a"}), withSession(u.Cookie)), http.StatusBadRequest, "Dati non validi")

	// Abitudini senza doppioni e nell'ordine dell'elenco; città e occupazione dagli elenchi condivisi
	rec = app.do(http.MethodPut, "/api/v1/me", profileInput(map[string]any{
		"lifestyleTags": []string{"socievole", "non_fumatore", "socievole"}, "city": "L'Aquila", "occupation": "studente_lavoratore",
	}), withSession(u.Cookie))
	expect(t, rec, http.StatusOK, `"city":"L'Aquila"`)
	expect(t, rec, http.StatusOK, `"occupation":"studente_lavoratore","bio":"ciao","lifestyleTags":["non_fumatore","socievole"]`)
}

// Anomalia F6: il ruolo cambiato nel profilo vale subito, senza rifare il login.
func TestRoleChangeAppliesWithoutNewLogin(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Sara", "cerca", false)

	expect(t, app.do(http.MethodPost, "/api/v1/listings", validListing(), withSession(u.Cookie)), http.StatusForbidden, "landlord_only")

	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(map[string]any{"userType": "affitta", "budgetMax": 0}), withSession(u.Cookie)), http.StatusOK, `"userType":"affitta"`)
	if s := app.session(u.Cookie); s.User == nil || s.User.UserType != "affitta" {
		t.Fatalf("sessione = %+v", s.User)
	}
	expect(t, app.do(http.MethodPost, "/api/v1/listings", validListing(), withSession(u.Cookie)), http.StatusCreated, "")

	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(nil), withSession(u.Cookie)), http.StatusOK, `"userType":"cerca"`)
	expect(t, app.do(http.MethodPost, "/api/v1/listings", validListing(), withSession(u.Cookie)), http.StatusForbidden, "landlord_only")
}
