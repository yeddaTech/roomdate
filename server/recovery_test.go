package server_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
)

// recoveryInput è una chiave di recupero come la prepara il browser.
func recoveryInput(code string) map[string]any {
	return map[string]any{
		"salt": b64("sale-recupero-" + code), "authKey": b64("verifica-" + code),
		"encryptedPrivateKey": b64("VAULT-RECUPERO-" + code), "iv": b64("IV-RECUPERO"),
	}
}

// registerWithRecovery registra un utente con chiavi di cifratura e chiave di recupero.
func (a *testApp) registerWithRecovery(name, code string) user {
	a.t.Helper()
	u := user{Email: strings.ToLower(name) + "@test.it", Password: testPassword}
	body := registration(name, u.Email, u.Password, "cerca", true)
	body["recovery"] = recoveryInput(code)
	rec := a.do(http.MethodPost, "/api/v1/auth/register", body)
	expect(a.t, rec, http.StatusCreated, "")
	var created struct{ ID string }
	decode(a.t, rec, &created)
	u.ID = created.ID
	u.Cookie = a.login(u.Email, u.Password)
	return u
}

func recoveryProof(email, code string) map[string]string {
	return map[string]string{"email": email, "recoveryKey": b64("verifica-" + code)}
}

func completeRecovery(email, code string) map[string]any {
	return map[string]any{
		"email": email, "recoveryKey": b64("verifica-" + code),
		"newPassword": b64("chiave-dopo-il-recupero"),
		"kdf":         map[string]any{"version": 2, "salt": b64("sale-dopo-il-recupero"), "iterations": 600000},
		"keys":        map[string]string{"encryptedPrivateKey": b64("VAULT-NUOVO"), "cryptoSalt": b64("sale-dopo-il-recupero"), "cryptoIv": b64("IV-NUOVO")},
	}
}

func TestRecoveryKeyAtRegistration(t *testing.T) {
	app := newApp(t)
	u := app.registerWithRecovery("Anna", "CODICE1")

	expect(t, app.do(http.MethodGet, "/api/v1/me", nil, withSession(u.Cookie)), http.StatusOK, `"hasRecoveryKey":true`)
	var hash string
	testPool.QueryRow(context.Background(), `SELECT recovery_hash FROM roomdate_app.users WHERE id = $1`, u.ID).Scan(&hash)
	if !strings.HasPrefix(hash, "$argon2id$") || strings.Contains(hash, b64("verifica-CODICE1")) {
		t.Fatalf("hash della chiave di recupero = %q", hash)
	}

	// Chi ha le chiavi della chat deve mandarne la copia: senza, il recupero farebbe perdere i messaggi
	body := registration("Bruno", "bruno@test.it", testPassword, "cerca", true)
	missing := recoveryInput("X")
	delete(missing, "encryptedPrivateKey")
	body["recovery"] = missing
	expect(t, app.do(http.MethodPost, "/api/v1/auth/register", body), http.StatusBadRequest, "Chiave di recupero non valida")

	// Senza chiave di recupero ci si registra comunque, e il profilo lo dice
	carla := app.registerUser("Carla", "cerca", false)
	expect(t, app.do(http.MethodGet, "/api/v1/me", nil, withSession(carla.Cookie)), http.StatusOK, `"hasRecoveryKey":false`)
}

// La risposta a "start" non rivela chi è registrato né chi ha una chiave di recupero.
func TestRecoveryStart(t *testing.T) {
	app := newApp(t)
	u := app.registerWithRecovery("Anna", "CODICE1")
	app.registerUser("Bruno", "cerca", false)

	start := func(email string) string {
		rec := app.do(http.MethodPost, "/api/v1/auth/recovery/start", map[string]string{"email": email})
		expect(t, rec, http.StatusOK, "")
		var body struct{ Salt string }
		decode(t, rec, &body)
		return body.Salt
	}
	if got := start(u.Email); got != b64("sale-recupero-CODICE1") {
		t.Errorf("sale di un account con chiave = %q", got)
	}
	for _, email := range []string{"bruno@test.it", "nessuno@test.it"} {
		first, second := start(email), start(email)
		if len(first) < 16 || first != second {
			t.Errorf("%s: sale finto %q, poi %q: deve essere credibile e stabile", email, first, second)
		}
	}
	if start("bruno@test.it") == start("nessuno@test.it") {
		t.Error("indirizzi diversi devono avere sali diversi")
	}
}

func TestRecoveryResetsPasswordKeepingChats(t *testing.T) {
	app := newApp(t)
	u := app.registerWithRecovery("Anna", "CODICE1")
	other := app.login(u.Email, u.Password)

	t.Run("codice sbagliato", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/v1/auth/recovery/verify", recoveryProof(u.Email, "SBAGLIATO"))
		expect(t, rec, http.StatusUnauthorized, "Email o chiave di recupero non valide")
		// Stessa risposta per un indirizzo inesistente
		unknown := app.do(http.MethodPost, "/api/v1/auth/recovery/verify", recoveryProof("nessuno@test.it", "CODICE1"))
		if unknown.Code != rec.Code || unknown.Body.String() != rec.Body.String() {
			t.Errorf("risposte diverse: %s e %s", rec.Body.String(), unknown.Body.String())
		}
		expect(t, app.do(http.MethodPost, "/api/v1/auth/recovery/complete", completeRecovery(u.Email, "SBAGLIATO")), http.StatusUnauthorized, "")
	})

	t.Run("il codice giusto restituisce la copia della chiave privata", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/v1/auth/recovery/verify", recoveryProof(u.Email, "CODICE1"))
		expect(t, rec, http.StatusOK, `"encryptedPrivateKey":"`+b64("VAULT-RECUPERO-CODICE1")+`"`)
		expect(t, rec, http.StatusOK, `"publicKey":"`+b64("PUB-Anna")+`"`)
	})

	t.Run("password nuova", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/v1/auth/recovery/complete", completeRecovery(u.Email, "CODICE1")), http.StatusNoContent, "")

		// La vecchia password non vale più, la nuova sì, con la chiave privata cifrata di nuovo
		expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": u.Email, "password": u.Password}), http.StatusUnauthorized, "")
		expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": u.Email, "password": b64("chiave-dopo-il-recupero")}), http.StatusOK, b64("VAULT-NUOVO"))
		// Le sessioni aperte prima del recupero sono chiuse
		for _, cookie := range []string{u.Cookie, other} {
			if app.session(cookie).User != nil {
				t.Error("una sessione aperta prima del recupero è ancora valida")
			}
		}
		// La chiave di recupero resta valida: la chiave privata non è cambiata
		expect(t, app.do(http.MethodPost, "/api/v1/auth/recovery/verify", recoveryProof(u.Email, "CODICE1")), http.StatusOK, "")
	})
}

func TestRecoveryThrottling(t *testing.T) {
	app := newApp(t)
	u := app.registerWithRecovery("Anna", "CODICE1")
	for i := 0; i < 5; i++ {
		expect(t, app.do(http.MethodPost, "/api/v1/auth/recovery/verify", recoveryProof(u.Email, "SBAGLIATO")), http.StatusUnauthorized, "")
	}
	// Anche il codice giusto deve aspettare: chi prova a indovinarlo viene rallentato
	expect(t, app.do(http.MethodPost, "/api/v1/auth/recovery/verify", recoveryProof(u.Email, "CODICE1")), http.StatusTooManyRequests, "Troppi tentativi")
	// I tentativi di recupero non bloccano l'accesso con la password
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": u.Email, "password": u.Password}), http.StatusOK, "")
}

// Dalle impostazioni si crea o si sostituisce la chiave di recupero; quella vecchia smette di valere.
func TestSetRecoveryKey(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Bruno", "cerca", true)
	path := "/api/v1/me/recovery"
	body := func(password, code string) map[string]any {
		return map[string]any{"currentPassword": password, "recovery": recoveryInput(code)}
	}

	expect(t, app.do(http.MethodPut, path, body(u.Password, "CODICE1")), http.StatusUnauthorized, "session_invalid")
	expect(t, app.do(http.MethodPut, path, body("sbagliata", "CODICE1"), withSession(u.Cookie)), http.StatusUnauthorized, "non è corretta")
	expect(t, app.do(http.MethodPut, path, body(u.Password, "CODICE1"), withSession(u.Cookie)), http.StatusNoContent, "")
	expect(t, app.do(http.MethodGet, "/api/v1/me", nil, withSession(u.Cookie)), http.StatusOK, `"hasRecoveryKey":true`)
	expect(t, app.do(http.MethodPost, "/api/v1/auth/recovery/verify", recoveryProof(u.Email, "CODICE1")), http.StatusOK, "")

	expect(t, app.do(http.MethodPut, path, body(u.Password, "CODICE2"), withSession(u.Cookie)), http.StatusNoContent, "")
	expect(t, app.do(http.MethodPost, "/api/v1/auth/recovery/verify", recoveryProof(u.Email, "CODICE1")), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodPost, "/api/v1/auth/recovery/verify", recoveryProof(u.Email, "CODICE2")), http.StatusOK, "")
}
