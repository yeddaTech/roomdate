package server_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
)

type kdfParams struct {
	Version    int
	Salt       string
	Iterations int
}

func (a *testApp) prelogin(email string) kdfParams {
	a.t.Helper()
	rec := a.do(http.MethodPost, "/api/v1/auth/prelogin", map[string]string{"email": email})
	expect(a.t, rec, http.StatusOK, "")
	var params kdfParams
	decode(a.t, rec, &params)
	return params
}

// makeLegacy riporta un account al vecchio metodo: la password arriva al server.
func makeLegacy(t *testing.T, userID string) {
	t.Helper()
	_, err := testPool.Exec(context.Background(),
		`UPDATE roomdate_app.users SET kdf_version = 1, kdf_salt = NULL, kdf_iterations = NULL WHERE id = $1`, userID)
	if err != nil {
		t.Fatal(err)
	}
}

// Prima di accedere il browser chiede come ricavare le chiavi dalla password.
func TestPrelogin(t *testing.T) {
	app := newApp(t)
	anna := app.registerUser("Anna", "cerca", false)

	t.Run("account registrato", func(t *testing.T) {
		got := app.prelogin(anna.Email)
		if got.Version != 2 || got.Salt != b64("sale-di-prova-1234") || got.Iterations != 600000 {
			t.Fatalf("parametri = %+v", got)
		}
		// Maiuscole e spazi non cambiano l'account
		if again := app.prelogin("  ANNA@test.it "); again != got {
			t.Errorf("parametri con maiuscole = %+v", again)
		}
	})

	t.Run("indirizzo inesistente: risposta credibile e sempre uguale", func(t *testing.T) {
		first := app.prelogin("nessuno@test.it")
		second := app.prelogin("nessuno@test.it")
		other := app.prelogin("qualcun-altro@test.it")
		if first.Version != 2 || first.Iterations != 600000 || len(first.Salt) < 16 {
			t.Fatalf("parametri per un indirizzo inesistente = %+v", first)
		}
		// Se il sale cambiasse a ogni richiesta, ripetendola si capirebbe che l'account non esiste
		if first != second {
			t.Errorf("parametri diversi per lo stesso indirizzo: %+v, %+v", first, second)
		}
		if first.Salt == other.Salt {
			t.Error("indirizzi diversi devono avere sali diversi")
		}
	})

	t.Run("account non ancora aggiornato", func(t *testing.T) {
		bruno := app.registerUser("Bruno", "cerca", false)
		makeLegacy(t, bruno.ID)
		if got := app.prelogin(bruno.Email); got.Version != 1 || got.Salt != "" {
			t.Fatalf("parametri per un account vecchio = %+v", got)
		}
	})
}

// Un account vecchio passa al metodo nuovo subito dopo l'accesso: da quel momento il server
// riceve solo la chiave d'accesso, e la chiave privata è cifrata con una chiave che resta nel browser.
func TestUpgradeKDF(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Carla", "cerca", true)
	makeLegacy(t, u.ID)
	ctx := context.Background()
	path := "/api/v1/auth/kdf"

	newAuthKey := b64("chiave-di-accesso-nuova")
	upgrade := func(current string, withKeys bool) map[string]any {
		body := map[string]any{
			"currentPassword": current, "authKey": newAuthKey,
			"kdf": map[string]any{"version": 2, "salt": b64("sale-nuovo-casuale"), "iterations": 650000},
		}
		if withKeys {
			body["keys"] = map[string]string{"encryptedPrivateKey": b64("VAULT-V2"), "cryptoSalt": b64("sale-nuovo-casuale"), "cryptoIv": b64("IV-V2")}
		}
		return body
	}

	expect(t, app.do(http.MethodPost, path, upgrade(u.Password, true)), http.StatusUnauthorized, "session_invalid")
	expect(t, app.do(http.MethodPost, path, upgrade("sbagliata", true), withSession(u.Cookie)), http.StatusUnauthorized, "non è corretta")
	// Chi ha una chiave privata deve mandarla cifrata di nuovo: altrimenti le chat diventerebbero illeggibili
	expect(t, app.do(http.MethodPost, path, upgrade(u.Password, false), withSession(u.Cookie)), http.StatusBadRequest, "vault_required")
	bad := upgrade(u.Password, true)
	bad["kdf"] = map[string]any{"version": 2, "salt": b64("sale-nuovo-casuale"), "iterations": 1000}
	expect(t, app.do(http.MethodPost, path, bad, withSession(u.Cookie)), http.StatusBadRequest, "Parametri di sicurezza")

	expect(t, app.do(http.MethodPost, path, upgrade(u.Password, true), withSession(u.Cookie)), http.StatusNoContent, "")

	var version, iterations int
	var salt, hash, vault string
	testPool.QueryRow(ctx, `
        SELECT kdf_version, kdf_salt, kdf_iterations, password_hash, encrypted_private_key
        FROM roomdate_app.users WHERE id = $1`, u.ID).Scan(&version, &salt, &iterations, &hash, &vault)
	if version != 2 || salt != b64("sale-nuovo-casuale") || iterations != 650000 || vault != b64("VAULT-V2") {
		t.Fatalf("account dopo l'aggiornamento: versione %d, sale %q, ripetizioni %d, chiave %q", version, salt, iterations, vault)
	}
	if !strings.HasPrefix(hash, "$argon2id$") || strings.Contains(hash, newAuthKey) {
		t.Fatalf("hash salvato = %q", hash)
	}

	// Ora si accede con la chiave d'accesso nuova, e la vecchia password non vale più
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": u.Email, "password": newAuthKey}), http.StatusOK, b64("VAULT-V2"))
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": u.Email, "password": u.Password}), http.StatusUnauthorized, "")
	if got := app.prelogin(u.Email); got.Version != 2 || got.Salt != b64("sale-nuovo-casuale") || got.Iterations != 650000 {
		t.Fatalf("prelogin dopo l'aggiornamento = %+v", got)
	}

	// Una seconda volta non serve
	expect(t, app.do(http.MethodPost, path, upgrade(newAuthKey, true), withSession(u.Cookie)), http.StatusConflict, "kdf_already_upgraded")
}

// Cambiando password cambia anche il sale: i nuovi parametri vanno salvati insieme alla password.
func TestChangePasswordStoresNewKDF(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Dario", "cerca", false)
	body := map[string]any{
		"currentPassword": u.Password, "newPassword": b64("altra-chiave-di-accesso"),
		"kdf": map[string]any{"version": 2, "salt": b64("sale-dopo-il-cambio"), "iterations": 700000},
	}
	expect(t, app.do(http.MethodPost, "/api/v1/auth/password", body, withSession(u.Cookie)), http.StatusNoContent, "")

	if got := app.prelogin(u.Email); got.Salt != b64("sale-dopo-il-cambio") || got.Iterations != 700000 {
		t.Fatalf("parametri dopo il cambio password = %+v", got)
	}
	expect(t, app.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": u.Email, "password": b64("altra-chiave-di-accesso")}), http.StatusOK, "")
}
