package server_test

// Test di integrazione: esercitano l'applicazione completa (rotte, middleware, servizi e query)
// con httptest su un database PostgreSQL reale.
//
// Si attivano impostando TEST_DATABASE_URL (anche in .env.local), la connessione a un server
// Postgres su cui l'utente può creare database. Per ogni esecuzione viene creato un database
// temporaneo "roomdate_test_…", migrato da zero ed eliminato alla fine: il database indicato
// nella stringa di connessione non viene mai modificato.

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"roomdate-backend/internal/config"
	"roomdate-backend/internal/db"
	"roomdate-backend/internal/devenv"
	"roomdate-backend/server"
)

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	os.Exit(run(m))
}

func run(m *testing.M) int {
	if root, ok := repoRoot(); ok {
		devenv.Load(filepath.Join(root, ".env.local"))
	}
	adminURL := os.Getenv("TEST_DATABASE_URL")
	if adminURL == "" {
		fmt.Println("TEST_DATABASE_URL non impostata: i test di integrazione vengono saltati")
		return m.Run()
	}

	ctx := context.Background()
	admin, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		fmt.Println("connessione a TEST_DATABASE_URL fallita:", err)
		return 1
	}
	defer admin.Close(ctx)

	suffix := make([]byte, 4)
	rand.Read(suffix)
	name := "roomdate_test_" + hex.EncodeToString(suffix)
	ident := pgx.Identifier{name}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+ident); err != nil {
		fmt.Println("creazione del database di test fallita:", err)
		return 1
	}
	defer admin.Exec(ctx, "DROP DATABASE IF EXISTS "+ident+" WITH (FORCE)")

	cfg, err := db.Config(adminURL)
	if err != nil {
		fmt.Println(err)
		return 1
	}
	cfg.ConnConfig.Database = name

	sqlDB := stdlib.OpenDB(*cfg.ConnConfig.Copy())
	goose.SetLogger(goose.NopLogger())
	err = db.Migrate(ctx, sqlDB, "up")
	sqlDB.Close()
	if err != nil {
		fmt.Println("migrazioni fallite:", err)
		return 1
	}

	testPool, err = pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		fmt.Println(err)
		return 1
	}
	defer testPool.Close()

	return m.Run()
}

func repoRoot() (string, bool) {
	dir, err := os.Getwd()
	if err != nil {
		return "", false
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", false
		}
		dir = parent
	}
}

// --- Applicazione di test ---

type event struct {
	Name string
	Data any
}

// recordingPublisher registra gli eventi in tempo reale invece di inviarli.
type recordingPublisher struct {
	mu     sync.Mutex
	events []event
	fail   bool
}

func (p *recordingPublisher) Publish(_ context.Context, name string, data any) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.fail {
		return fmt.Errorf("pusher: 500 Internal Server Error (dettaglio interno)")
	}
	p.events = append(p.events, event{Name: name, Data: data})
	return nil
}

func (p *recordingPublisher) recorded() []event {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]event(nil), p.events...)
}

type testApp struct {
	t         *testing.T
	handler   http.Handler
	publisher *recordingPublisher
}

// newApp svuota il database e crea un'applicazione nuova.
func newApp(t *testing.T) *testApp {
	t.Helper()
	if testPool == nil {
		t.Skip("TEST_DATABASE_URL non impostata")
	}
	_, err := testPool.Exec(context.Background(),
		`TRUNCATE roomdate_app.messages, roomdate_app.conversations, roomdate_app.listings, roomdate_app.users RESTART IDENTITY CASCADE`)
	if err != nil {
		t.Fatal(err)
	}

	publisher := &recordingPublisher{}
	handler, err := server.New(server.Deps{
		Config:    config.Config{JWTSecret: "segreto-di-test", SecureCookies: true},
		DB:        testPool,
		Publisher: publisher,
		Logger:    slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	if err != nil {
		t.Fatal(err)
	}
	return &testApp{t: t, handler: handler, publisher: publisher}
}

type option func(*http.Request)

func withSession(cookie string) option {
	return func(r *http.Request) {
		if cookie != "" {
			r.AddCookie(&http.Cookie{Name: "roomdate_session", Value: cookie})
		}
	}
}

func withHeader(key, value string) option {
	return func(r *http.Request) { r.Header.Set(key, value) }
}

// do esegue una richiesta. body viene inviato come JSON, a meno che non sia già una stringa.
func (a *testApp) do(method, path string, body any, opts ...option) *httptest.ResponseRecorder {
	a.t.Helper()
	var reader io.Reader
	switch b := body.(type) {
	case nil:
	case string:
		reader = strings.NewReader(b)
	default:
		encoded, err := json.Marshal(b)
		if err != nil {
			a.t.Fatal(err)
		}
		reader = bytes.NewReader(encoded)
	}

	req := httptest.NewRequest(method, "http://roomdate.test"+path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for _, opt := range opts {
		opt(req)
	}
	rec := httptest.NewRecorder()
	a.handler.ServeHTTP(rec, req)
	return rec
}

type user struct {
	ID, Email, Password, Cookie string
}

// registerUser registra un utente (con chiavi E2EE fittizie se withVault) ed esegue il login.
func (a *testApp) registerUser(name, userType string, withVault bool) user {
	a.t.Helper()
	u := user{Email: strings.ToLower(name) + "@test.it", Password: "password-" + strings.ToLower(name)}
	rec := a.do(http.MethodPost, "/api/v1/auth/register", registration(name, u.Email, u.Password, userType, withVault))
	if rec.Code != http.StatusCreated {
		a.t.Fatalf("registrazione di %s: %d %s", name, rec.Code, rec.Body.String())
	}
	var created struct{ ID string }
	decode(a.t, rec, &created)
	u.ID = created.ID
	u.Cookie = a.login(u.Email, u.Password)
	return u
}

// registration restituisce il corpo di una registrazione valida.
func registration(name, email, password, userType string, withVault bool) map[string]any {
	body := map[string]any{
		"firstName": name, "lastName": "Rossi", "email": email, "password": password,
		"city": "Milano", "userType": userType, "birthdate": "1999-01-01", "budgetMax": 500,
		"occupation": "Studente", "bio": "ciao", "lifestyleTags": "Socievole",
	}
	if withVault {
		body["keys"] = map[string]string{
			"publicKey": b64("PUB-" + name), "encryptedPrivateKey": b64("VAULT-" + name),
			"cryptoSalt": b64("SALT"), "cryptoIv": b64("IV"),
		}
	}
	return body
}

func (a *testApp) login(email, password string) string {
	a.t.Helper()
	rec := a.do(http.MethodPost, "/api/v1/auth/login", map[string]string{"email": email, "password": password})
	if rec.Code != http.StatusOK {
		a.t.Fatalf("login di %s: %d %s", email, rec.Code, rec.Body.String())
	}
	return sessionCookie(rec)
}

func sessionCookie(rec *httptest.ResponseRecorder) string {
	for _, c := range rec.Result().Cookies() {
		if c.Name == "roomdate_session" {
			return c.Value
		}
	}
	return ""
}

func decode(t *testing.T, rec *httptest.ResponseRecorder, v any) {
	t.Helper()
	if err := json.Unmarshal(rec.Body.Bytes(), v); err != nil {
		t.Fatalf("risposta non JSON (%d): %s", rec.Code, rec.Body.String())
	}
}

func b64(s string) string {
	return base64.StdEncoding.EncodeToString([]byte(s))
}

// expect verifica stato e (se indicato) una parte del corpo della risposta.
func expect(t *testing.T, rec *httptest.ResponseRecorder, status int, bodyContains string) {
	t.Helper()
	if rec.Code != status {
		t.Fatalf("stato = %d, atteso %d (corpo: %s)", rec.Code, status, strings.TrimSpace(rec.Body.String()))
	}
	if bodyContains != "" && !strings.Contains(rec.Body.String(), bodyContains) {
		t.Fatalf("il corpo %q non contiene %q", strings.TrimSpace(rec.Body.String()), bodyContains)
	}
}

// expectNoLeak verifica che la risposta non contenga dettagli tecnici del database.
func expectNoLeak(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()
	for _, fragment := range []string{"pq:", "SQLSTATE", "constraint", "violates", "syntax", "roomdate_app"} {
		if strings.Contains(rec.Body.String(), fragment) {
			t.Fatalf("la risposta contiene dettagli interni (%q): %s", fragment, rec.Body.String())
		}
	}
}
