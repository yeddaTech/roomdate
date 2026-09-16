package server_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
)

func TestRegisterAndLogin(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Anna", "cerca", true)

	t.Run("login restituisce utente e chiavi", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/login", map[string]string{"email": u.Email, "password": u.Password})
		expect(t, rec, http.StatusOK, "")
		var body struct {
			Message             string
			User                map[string]string
			EncryptedPrivateKey string
			PublicKey           string
		}
		decode(t, rec, &body)
		if body.User["id"] != u.ID || body.User["nome"] != "Anna" || body.User["email"] != u.Email || body.User["user_type"] != "cerca" {
			t.Errorf("user = %v", body.User)
		}
		if body.EncryptedPrivateKey != b64("VAULT-Anna") || body.PublicKey != b64("PUB-Anna") {
			t.Errorf("chiavi = %q, %q", body.EncryptedPrivateKey, body.PublicKey)
		}
		cookie := rec.Result().Cookies()[0]
		if cookie.Name != "roomdate_session" || !cookie.HttpOnly || !cookie.Secure {
			t.Errorf("cookie = %+v", cookie)
		}
	})

	t.Run("validate_session", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/login", map[string]string{"action": "validate_session"}, withSession(u.Cookie))
		expect(t, rec, http.StatusOK, `"email":"anna@test.it"`)
		expect(t, app.do(http.MethodPost, "/api/login", map[string]string{"action": "validate_session"}), http.StatusUnauthorized, "")
		expect(t, app.do(http.MethodPost, "/api/login", map[string]string{"action": "validate_session"}, withSession("token.falso.x")), http.StatusUnauthorized, "")
	})

	t.Run("credenziali errate", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/login", map[string]string{"email": u.Email, "password": "sbagliata"}), http.StatusUnauthorized, "Password errata")
		expect(t, app.do(http.MethodPost, "/api/login", map[string]string{"email": "nessuno@test.it", "password": "x"}), http.StatusUnauthorized, "")
	})

	t.Run("email già registrata", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/register", map[string]any{
			"nome": "Altra", "cognome": "Anna", "email": u.Email, "password": "password-altra",
			"userType": "cerca", "nascita": "2000-01-01",
		})
		expect(t, rec, http.StatusConflict, "Impossibile completare la registrazione")
		expectNoLeak(t, rec)
	})
}

func TestRegisterValidation(t *testing.T) {
	app := newApp(t)
	valid := func() map[string]any {
		return map[string]any{
			"nome": "Bruno", "cognome": "Bianchi", "email": "bruno@test.it", "password": "password-bruno",
			"citta": "Roma", "userType": "affitta", "nascita": "1990-05-10", "budgetMax": 0,
		}
	}
	cases := []struct {
		name, field string
		value       any
		message     string
	}{
		{"nome vuoto", "nome", "   ", "Il nome è obbligatorio"},
		{"nome solo HTML", "nome", "<b></b>", "Il nome è obbligatorio"},
		{"email non valida", "email", "bruno", "Inserisci un indirizzo email valido"},
		{"password corta", "password", "12345", "almeno 6 caratteri"},
		{"password oltre 72 byte", "password", strings.Repeat("x", 73), "troppo lunga"},
		{"tipo utente sconosciuto", "userType", "admin", "Tipo di utente non valido"},
		{"data di nascita vuota", "nascita", "", "Data di nascita non valida"},
		{"data di nascita futura", "nascita", "2999-01-01", "Data di nascita non valida"},
		{"budget negativo", "budgetMax", -1, "budget"},
		{"bio troppo lunga", "bio", strings.Repeat("a", 1001), "bio"},
		{"chiavi incomplete", "publicKey", b64("solo-la-pubblica"), "Chiavi di cifratura non valide"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			body := valid()
			body[c.field] = c.value
			rec := app.do(http.MethodPost, "/api/register", body)
			expect(t, rec, http.StatusBadRequest, c.message)
		})
	}

	t.Run("i dati validi passano", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/register", valid()), http.StatusCreated, `"status":"success"`)
	})
}

func TestLoginLockout(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Carla", "cerca", false)

	for i := 1; i < 5; i++ {
		expect(t, app.do(http.MethodPost, "/api/login", map[string]string{"email": u.Email, "password": "no"}), http.StatusUnauthorized, "")
	}
	expect(t, app.do(http.MethodPost, "/api/login", map[string]string{"email": u.Email, "password": "no"}), http.StatusTooManyRequests, "bloccato")
	expect(t, app.do(http.MethodPost, "/api/login", map[string]string{"email": u.Email, "password": u.Password}), http.StatusTooManyRequests, "")
}

func TestLogoutClearsCookie(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Dario", "cerca", false)

	rec := app.do(http.MethodPost, "/api/login", map[string]string{"action": "logout"}, withSession(u.Cookie))
	expect(t, rec, http.StatusOK, "")
	header := rec.Header().Get("Set-Cookie")
	if !strings.Contains(header, "roomdate_session=;") || !strings.Contains(header, "Max-Age=0") {
		t.Fatalf("Set-Cookie = %q", header)
	}
}

func TestUpdatePassword(t *testing.T) {
	app := newApp(t)
	anna := app.registerUser("Anna", "cerca", true)
	bruno := app.registerUser("Bruno", "affitta", false)
	// changePassword costruisce la richiesta; withVault aggiunge la chiave privata cifrata di nuovo
	changePassword := func(current, next string, withVault bool) map[string]string {
		body := map[string]string{"action": "update_password", "currentPassword": current, "newPassword": next}
		if withVault {
			body["encryptedPrivateKey"] = b64("VAULT-NEW")
			body["cryptoSalt"] = b64("SALT-NEW")
			body["cryptoIv"] = b64("IV-NEW")
		}
		return body
	}
	vaultOf := func(id string) string {
		var vault string
		testPool.QueryRow(context.Background(), `SELECT COALESCE(encrypted_private_key, '') FROM roomdate_app.users WHERE id = $1`, id).Scan(&vault)
		return vault
	}

	expect(t, app.do(http.MethodPost, "/api/login", changePassword(anna.Password, "nuovapass1", true)), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodPost, "/api/login", changePassword(anna.Password, "123", true), withSession(anna.Cookie)), http.StatusBadRequest, "almeno 6")
	expect(t, app.do(http.MethodPost, "/api/login", changePassword(anna.Password, "nuovapass1", false), withSession(anna.Cookie)), http.StatusBadRequest, "Chiavi di cifratura mancanti")
	expect(t, app.do(http.MethodPost, "/api/login", changePassword("sbagliata", "nuovapass1", true), withSession(anna.Cookie)), http.StatusUnauthorized, "La password attuale non è corretta")
	if vaultOf(anna.ID) != b64("VAULT-Anna") {
		t.Fatal("la chiave non deve cambiare dopo un errore")
	}

	expect(t, app.do(http.MethodPost, "/api/login", changePassword(anna.Password, "nuovapass1", true), withSession(anna.Cookie)), http.StatusOK, "")
	if vaultOf(anna.ID) != b64("VAULT-NEW") {
		t.Fatal("la chiave privata deve cambiare insieme alla password")
	}
	expect(t, app.do(http.MethodPost, "/api/login", map[string]string{"email": anna.Email, "password": anna.Password}), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodPost, "/api/login", map[string]string{"email": anna.Email, "password": "nuovapass1"}), http.StatusOK, b64("VAULT-NEW"))

	// Utente senza chiavi: nessuna chiave richiesta e nessuna chiave aggiunta
	expect(t, app.do(http.MethodPost, "/api/login", changePassword(bruno.Password, "brunopass2", true), withSession(bruno.Cookie)), http.StatusOK, "")
	if vaultOf(bruno.ID) != "" {
		t.Fatal("non va aggiunta una chiave a un utente che non l'aveva")
	}
}

func TestDeleteAccount(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Elena", "cerca", false)

	expect(t, app.do(http.MethodPost, "/api/login", map[string]string{"action": "delete_account"}), http.StatusUnauthorized, "")

	rec := app.do(http.MethodPost, "/api/login", map[string]string{"action": "delete_account"}, withSession(u.Cookie))
	expect(t, rec, http.StatusOK, "Account eliminato")
	if !strings.Contains(rec.Header().Get("Set-Cookie"), "Max-Age=0") {
		t.Error("il cookie di sessione va cancellato")
	}
	expect(t, app.do(http.MethodPost, "/api/login", map[string]string{"action": "validate_session"}, withSession(u.Cookie)), http.StatusUnauthorized, "")
}

func TestDeleteAccountDatabaseErrorIsGeneric(t *testing.T) {
	app := newApp(t)
	landlord := app.registerUser("Marco", "affitta", false)
	expect(t, app.do(http.MethodPost, "/api/create_listing", validListing(), withSession(landlord.Cookie)), http.StatusCreated, "")

	// Con annunci collegati il vincolo di chiave esterna blocca l'eliminazione
	rec := app.do(http.MethodPost, "/api/login", map[string]string{"action": "delete_account"}, withSession(landlord.Cookie))
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
			rec := app.do(http.MethodGet, "/api/profile?userId="+anna.ID, nil, withSession(cookie))
			expect(t, rec, http.StatusOK, `"nome":"Anna"`)
			var body map[string]any
			decode(t, rec, &body)
			for _, private := range []string{"email", "cognome", "nascita", "is_public"} {
				if _, found := body[private]; found {
					t.Errorf("il profilo pubblico contiene %q", private)
				}
			}
		}
	})

	t.Run("profilo proprio: completo", func(t *testing.T) {
		expect(t, app.do(http.MethodGet, "/api/profile", nil, withSession(anna.Cookie)), http.StatusOK, `"email":"anna@test.it"`)
		expect(t, app.do(http.MethodGet, "/api/profile?userId="+anna.ID, nil, withSession(anna.Cookie)), http.StatusOK, `"email":"anna@test.it"`)
		expect(t, app.do(http.MethodGet, "/api/profile", nil, withSession(carla.Cookie)), http.StatusOK, `"email":"carla@test.it"`)
	})

	t.Run("profilo privato o inesistente", func(t *testing.T) {
		expect(t, app.do(http.MethodGet, "/api/profile?userId="+carla.ID, nil, withSession(anna.Cookie)), http.StatusNotFound, "")
		expect(t, app.do(http.MethodGet, "/api/profile?userId="+carla.ID, nil), http.StatusNotFound, "")
		expect(t, app.do(http.MethodGet, "/api/profile?userId=99999", nil), http.StatusNotFound, "")
		expect(t, app.do(http.MethodGet, "/api/profile?userId=abc", nil), http.StatusNotFound, "")
		expect(t, app.do(http.MethodGet, "/api/profile", nil), http.StatusUnauthorized, "")
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

func TestUpdateProfile(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Giulia", "cerca", false)
	profile := func(fields map[string]any) map[string]any {
		body := map[string]any{
			"userType": "cerca", "citta": "Milano", "budgetMax": 650, "occupation": "Studente",
			"birthdate": "1999-04-12", "bio": "ciao", "tags": "Socievole", "isPublic": true,
		}
		for k, v := range fields {
			body[k] = v
		}
		return body
	}

	expect(t, app.do(http.MethodPost, "/api/profile", profile(nil)), http.StatusUnauthorized, "")

	bio := `Cerco un'amica & <b>coinquilina</b> "tranquilla"`
	expect(t, app.do(http.MethodPost, "/api/profile", profile(map[string]any{"bio": bio, "budgetMax": "700"}), withSession(u.Cookie)), http.StatusOK, "Profilo aggiornato")

	rec := app.do(http.MethodGet, "/api/profile", nil, withSession(u.Cookie))
	var body map[string]any
	decode(t, rec, &body)
	if body["bio"] != `Cerco un'amica & coinquilina "tranquilla"` || body["budget_max"] != float64(700) {
		t.Fatalf("profilo = %s", rec.Body.String())
	}

	expect(t, app.do(http.MethodPost, "/api/profile", profile(map[string]any{"budgetMax": "tanti"}), withSession(u.Cookie)), http.StatusBadRequest, "Budget non valido")
	expect(t, app.do(http.MethodPost, "/api/profile", profile(map[string]any{"userType": "admin"}), withSession(u.Cookie)), http.StatusBadRequest, "Tipo di utente")
	expect(t, app.do(http.MethodPost, "/api/profile", profile(map[string]any{"birthdate": ""}), withSession(u.Cookie)), http.StatusBadRequest, "Data di nascita")
}
