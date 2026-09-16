package server_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
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
		if cookie.Name != "roomdate_session" || !cookie.HttpOnly || !cookie.Secure {
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
		rec := app.do(http.MethodPost, "/api/v1/auth/register", registration("Altra", u.Email, "password-altra", "cerca", false))
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
		{"nome solo HTML", "firstName", "<b></b>", "Il nome è obbligatorio"},
		{"email non valida", "email", "bruno", "Inserisci un indirizzo email valido"},
		{"password corta", "password", "12345", "almeno 6 caratteri"},
		{"password oltre 72 byte", "password", strings.Repeat("x", 73), "troppo lunga"},
		{"tipo utente sconosciuto", "userType", "admin", "Tipo di utente non valido"},
		{"data di nascita vuota", "birthdate", "", "Data di nascita non valida"},
		{"data di nascita futura", "birthdate", "2999-01-01", "Data di nascita non valida"},
		{"budget negativo", "budgetMax", -1, "budget"},
		{"bio troppo lunga", "bio", strings.Repeat("a", 1001), "bio"},
		{"chiavi incomplete", "keys", map[string]string{"publicKey": b64("solo-la-pubblica")}, "Chiavi di cifratura non valide"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			body := registration("Bruno", "bruno@test.it", "password-bruno", "affitta", false)
			body[c.field] = c.value
			rec := app.do(http.MethodPost, "/api/v1/auth/register", body)
			expect(t, rec, http.StatusBadRequest, c.message)
			expect(t, rec, http.StatusBadRequest, `"field":"`+c.field+`"`)
		})
	}

	t.Run("i dati validi passano", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/v1/auth/register", registration("Bruno", "bruno@test.it", "password-bruno", "affitta", false)), http.StatusCreated, `"id":`)
	})
}

func TestLoginLockout(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Carla", "cerca", false)
	login := func(password string) map[string]string {
		return map[string]string{"email": u.Email, "password": password}
	}

	for i := 1; i < 5; i++ {
		expect(t, app.do(http.MethodPost, "/api/v1/auth/login", login("no")), http.StatusUnauthorized, "")
	}
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", login("no")), http.StatusTooManyRequests, "bloccato")
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", login(u.Password)), http.StatusTooManyRequests, "")
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

func TestChangePassword(t *testing.T) {
	app := newApp(t)
	anna := app.registerUser("Anna", "cerca", true)
	bruno := app.registerUser("Bruno", "affitta", false)

	// changePassword costruisce la richiesta; withKeys aggiunge la chiave privata cifrata di nuovo
	changePassword := func(current, next string, withKeys bool) map[string]any {
		body := map[string]any{"currentPassword": current, "newPassword": next}
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

	expect(t, app.do(http.MethodPost, path, changePassword(anna.Password, "nuovapass1", true)), http.StatusUnauthorized, "session_invalid")
	expect(t, app.do(http.MethodPost, path, changePassword(anna.Password, "123", true), withSession(anna.Cookie)), http.StatusBadRequest, "almeno 6")
	expect(t, app.do(http.MethodPost, path, changePassword(anna.Password, "nuovapass1", false), withSession(anna.Cookie)), http.StatusBadRequest, "Chiavi di cifratura mancanti")
	// Password attuale errata: codice invalid_credentials, che il frontend non scambia per una sessione scaduta
	expect(t, app.do(http.MethodPost, path, changePassword("sbagliata", "nuovapass1", true), withSession(anna.Cookie)), http.StatusUnauthorized, `"code":"invalid_credentials"`)
	if vaultOf(anna.ID) != b64("VAULT-Anna") {
		t.Fatal("la chiave non deve cambiare dopo un errore")
	}

	expect(t, app.do(http.MethodPost, path, changePassword(anna.Password, "nuovapass1", true), withSession(anna.Cookie)), http.StatusNoContent, "")
	if vaultOf(anna.ID) != b64("VAULT-NEW") {
		t.Fatal("la chiave privata deve cambiare insieme alla password")
	}
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": anna.Email, "password": anna.Password}), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": anna.Email, "password": "nuovapass1"}), http.StatusOK, b64("VAULT-NEW"))

	// Utente senza chiavi: nessuna chiave richiesta e nessuna chiave aggiunta
	expect(t, app.do(http.MethodPost, path, changePassword(bruno.Password, "brunopass2", true), withSession(bruno.Cookie)), http.StatusNoContent, "")
	if vaultOf(bruno.ID) != "" {
		t.Fatal("non va aggiunta una chiave a un utente che non l'aveva")
	}
}

func TestDeleteAccount(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Elena", "cerca", false)

	expect(t, app.do(http.MethodDelete, "/api/v1/me", nil), http.StatusUnauthorized, "")

	rec := app.do(http.MethodDelete, "/api/v1/me", nil, withSession(u.Cookie))
	expect(t, rec, http.StatusNoContent, "")
	if !strings.Contains(rec.Header().Get("Set-Cookie"), "Max-Age=0") {
		t.Error("il cookie di sessione va cancellato")
	}
	// Il vecchio cookie è ancora firmato correttamente, ma l'utente non esiste più
	if s := app.session(u.Cookie); s.User != nil {
		t.Fatal("la sessione di un utente eliminato non è valida")
	}
}

func TestDeleteAccountDatabaseErrorIsGeneric(t *testing.T) {
	app := newApp(t)
	landlord := app.registerUser("Marco", "affitta", false)
	expect(t, app.do(http.MethodPost, "/api/create_listing", validListing(), withSession(landlord.Cookie)), http.StatusCreated, "")

	// Con annunci collegati il vincolo di chiave esterna blocca l'eliminazione
	rec := app.do(http.MethodDelete, "/api/v1/me", nil, withSession(landlord.Cookie))
	expect(t, rec, http.StatusInternalServerError, "Impossibile eliminare l'account")
	expectNoLeak(t, rec)
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

	t.Run("elenco coinquilini senza profili privati né email", func(t *testing.T) {
		rec := app.do(http.MethodGet, "/api/get_roommates", nil)
		expect(t, rec, http.StatusOK, "")
		var roommates []map[string]any
		decode(t, rec, &roommates)
		ids := map[string]bool{}
		for _, r := range roommates {
			ids[r["id"].(string)] = true
		}
		if !ids[anna.ID] || !ids[bruno.ID] || ids[carla.ID] || strings.Contains(rec.Body.String(), "@test.it") {
			t.Fatalf("elenco = %s", rec.Body.String())
		}
	})
}

func profileInput(fields map[string]any) map[string]any {
	body := map[string]any{
		"userType": "cerca", "city": "Milano", "budgetMax": 650, "occupation": "Studente",
		"birthdate": "1999-04-12", "bio": "ciao", "lifestyleTags": "Socievole", "isPublic": true,
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
	if profile.Bio != `Cerco un'amica & coinquilina "tranquilla"` || profile.BudgetMax != 700 || profile.Email != u.Email {
		t.Fatalf("profilo restituito = %s", rec.Body.String())
	}

	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(map[string]any{"budgetMax": "tanti"}), withSession(u.Cookie)), http.StatusBadRequest, "Dati non validi")
	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(map[string]any{"userType": "admin"}), withSession(u.Cookie)), http.StatusBadRequest, "Tipo di utente")
	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(map[string]any{"birthdate": ""}), withSession(u.Cookie)), http.StatusBadRequest, `"field":"birthdate"`)
}

// Anomalia F6: il ruolo cambiato nel profilo vale subito, senza rifare il login.
func TestRoleChangeAppliesWithoutNewLogin(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Sara", "cerca", false)

	expect(t, app.do(http.MethodPost, "/api/create_listing", validListing(), withSession(u.Cookie)), http.StatusForbidden, "Solo i proprietari")

	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(map[string]any{"userType": "affitta", "budgetMax": 0}), withSession(u.Cookie)), http.StatusOK, `"userType":"affitta"`)
	if s := app.session(u.Cookie); s.User == nil || s.User.UserType != "affitta" {
		t.Fatalf("sessione = %+v", s.User)
	}
	expect(t, app.do(http.MethodPost, "/api/create_listing", validListing(), withSession(u.Cookie)), http.StatusCreated, "")

	expect(t, app.do(http.MethodPut, "/api/v1/me", profileInput(nil), withSession(u.Cookie)), http.StatusOK, `"userType":"cerca"`)
	expect(t, app.do(http.MethodDelete, "/api/delete_listing?id=1", nil, withSession(u.Cookie)), http.StatusForbidden, "Solo i proprietari")
}
