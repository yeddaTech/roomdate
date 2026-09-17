package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNewManagerRejectsEmptySecret(t *testing.T) {
	if _, err := NewManager(&Store{}, "", true); err == nil {
		t.Fatal("un segreto vuoto va rifiutato")
	}
	if _, err := NewManager(nil, "segreto", true); err == nil {
		t.Fatal("senza store non si possono creare sessioni")
	}
}

// In produzione il cookie usa il prefisso __Host-, che il browser accetta solo su HTTPS.
func TestCookieName(t *testing.T) {
	secure, _ := NewManager(&Store{}, "segreto", true)
	local, _ := NewManager(&Store{}, "segreto", false)
	if secure.CookieName() != "__Host-roomdate_session" || local.CookieName() != "roomdate_session" {
		t.Fatalf("nomi = %q, %q", secure.CookieName(), local.CookieName())
	}
}

func TestClearCookie(t *testing.T) {
	m, _ := NewManager(&Store{}, "segreto", true)
	rec := httptest.NewRecorder()
	m.ClearCookie(rec)

	header := rec.Header().Get("Set-Cookie")
	for _, want := range []string{"__Host-roomdate_session=;", "Max-Age=0", "HttpOnly", "Secure", "SameSite=Lax", "Path=/"} {
		if !strings.Contains(header, want) {
			t.Errorf("Set-Cookie %q non contiene %q", header, want)
		}
	}
}

// Il token del cookie è casuale e la sua impronta non lo rivela.
func TestTokens(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		token, err := newToken()
		if err != nil {
			t.Fatal(err)
		}
		if len(token) < 40 || seen[token] {
			t.Fatalf("token debole o ripetuto: %q", token)
		}
		seen[token] = true
		if hash := hashToken(token); len(hash) != 64 || strings.Contains(hash, token) {
			t.Fatalf("impronta = %q", hash)
		}
	}
}

func TestIPHash(t *testing.T) {
	m, _ := NewManager(&Store{}, "segreto", true)
	other, _ := NewManager(&Store{}, "altro-segreto", true)

	request := func(remote, forwarded string) *http.Request {
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.RemoteAddr = remote
		if forwarded != "" {
			r.Header.Set("X-Forwarded-For", forwarded)
		}
		return r
	}
	direct := m.IPHash(request("203.0.113.7:4444", ""))
	proxied := m.IPHash(request("10.0.0.1:4444", "203.0.113.7, 70.41.3.18"))
	if direct == "" || direct != proxied {
		t.Errorf("l'indirizzo dietro il proxy va letto da X-Forwarded-For: %q, %q", direct, proxied)
	}
	if strings.Contains(direct, "203.0.113.7") {
		t.Error("l'impronta non deve contenere l'indirizzo")
	}
	if direct == other.IPHash(request("203.0.113.7:4444", "")) {
		t.Error("impronte uguali con segreti diversi")
	}
	if m.IPHash(request("", "")) != "" {
		t.Error("senza indirizzo non c'è impronta")
	}
}

func TestDeviceLabel(t *testing.T) {
	cases := map[string]string{
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36": "Chrome su Linux",
		"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1":          "Safari su iOS",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0":                  "Firefox su Windows",
		"":           "Dispositivo sconosciuto",
		"curl/8.5.0": "Browser",
	}
	for userAgent, want := range cases {
		if got := deviceLabel(userAgent); got != want {
			t.Errorf("deviceLabel(%q) = %q, atteso %q", userAgent, got, want)
		}
	}
}

func TestPasswordHashing(t *testing.T) {
	hash, err := HashPassword("una-password-lunga")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(hash, "$argon2id$v=19$m=19456,t=2,p=1$") {
		t.Fatalf("hash = %q", hash)
	}

	if ok, legacy := CheckPassword(hash, "una-password-lunga"); !ok || legacy {
		t.Errorf("password corretta = %v, legacy %v", ok, legacy)
	}
	if ok, _ := CheckPassword(hash, "una-password-lungA"); ok {
		t.Error("password errata accettata")
	}
	// Due hash della stessa password sono diversi: il sale è casuale
	other, _ := HashPassword("una-password-lunga")
	if other == hash {
		t.Error("hash identici per la stessa password")
	}
	for _, malformed := range []string{"", "non-un-hash", "$argon2id$v=19$m=19456$sale$chiave", "$argon2id$v=1$m=1,t=1,p=1$c2FsZQ$a2V5"} {
		if ok, _ := CheckPassword(malformed, "una-password-lunga"); ok {
			t.Errorf("hash malformato accettato: %q", malformed)
		}
	}
}

// Gli account registrati prima hanno hash bcrypt: vanno accettati e segnalati per l'aggiornamento.
func TestLegacyBcryptHash(t *testing.T) {
	// Hash bcrypt di "password-di-prova", come li generava la versione precedente
	const bcryptHash = "$2a$10$zcgbUGI86/Ags373qHkHb.OnDKEiS/Uxmc1G8OLwzGcLOz7gS9.Vu"
	ok, legacy := CheckPassword(bcryptHash, "password-di-prova")
	if !ok || !legacy {
		t.Fatalf("hash bcrypt: ok = %v, legacy = %v", ok, legacy)
	}
	if ok, _ := CheckPassword(bcryptHash, "sbagliata"); ok {
		t.Error("password errata accettata su hash bcrypt")
	}
}

func TestPasswordProblem(t *testing.T) {
	const email = "giulia.bianchi@example.com"
	cases := map[string]string{
		"una-frase-lunga-e-strana": "",
		"corta1":                   "almeno 10 caratteri",
		"password123":              "tra le più usate",
		"aaaaaaaaaaaa":             "troppo semplice",
		"abcdefghijkl":             "troppo semplice",
		"giulia.bianchi2026":       "il tuo nome o la tua email",
		"Giulia-questa-password":   "il tuo nome o la tua email",
		"roomdate-sicuro-2026":     "il nome del sito",
		strings.Repeat("x", 200):   "troppo lunga",
	}
	for password, want := range cases {
		got := PasswordProblem(password, email, "Giulia")
		if want == "" && got != "" {
			t.Errorf("password %q rifiutata: %s", password, got)
		}
		if want != "" && !strings.Contains(got, want) {
			t.Errorf("password %q: messaggio %q, atteso qualcosa con %q", password, got, want)
		}
	}
}

// Dopo qualche tentativo fallito l'attesa cresce, ma l'account non si blocca mai del tutto.
func TestRetryAfter(t *testing.T) {
	now := time.Date(2026, 9, 18, 10, 0, 0, 0, time.UTC)
	recent := FailedLogins{LastAttempt: now.Add(-1 * time.Second)}

	for _, failures := range []int{0, 1, 4} {
		attempt := recent
		attempt.ByEmail = failures
		if wait := RetryAfter(attempt, now); wait != 0 {
			t.Errorf("%d tentativi: attesa %v, attesa nessuna", failures, wait)
		}
	}

	attempt := recent
	attempt.ByEmail = 5
	if wait := RetryAfter(attempt, now); wait <= 0 || wait > 30*time.Second {
		t.Errorf("al quinto tentativo l'attesa = %v", wait)
	}
	attempt.ByEmail = 7
	if wait := RetryAfter(attempt, now); wait < time.Minute {
		t.Errorf("l'attesa deve crescere: %v", wait)
	}
	attempt.ByEmail = 100
	if wait := RetryAfter(attempt, now); wait > maxDelay {
		t.Errorf("l'attesa non deve superare %v: %v", maxDelay, wait)
	}

	// Passato il tempo dell'attesa si può riprovare
	old := FailedLogins{ByEmail: 6, LastAttempt: now.Add(-10 * time.Minute)}
	if wait := RetryAfter(old, now); wait != 0 {
		t.Errorf("attesa già trascorsa: %v", wait)
	}
	// Un solo indirizzo con molti tentativi (rete condivisa) tollera più errori di un account
	shared := FailedLogins{ByIP: 10, LastAttempt: now.Add(-1 * time.Second)}
	if wait := RetryAfter(shared, now); wait != 0 {
		t.Errorf("10 tentativi dalla stessa rete: attesa %v", wait)
	}
	shared.ByIP = 25
	if wait := RetryAfter(shared, now); wait <= 0 {
		t.Error("troppi tentativi dalla stessa rete devono far aspettare")
	}
}
