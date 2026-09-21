package server_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/stdlib"

	"roomdate-backend/internal/db"
)

// Il ruolo dell'applicazione legge e scrive i dati, ma non può cambiare lo schema né svuotare
// le tabelle: un errore del codice sfruttato da qualcuno non può distruggere il database.
func TestAppRoleHasOnlyDataPrivileges(t *testing.T) {
	if appPool == nil {
		t.Skip("TEST_DATABASE_URL non impostata")
	}
	ctx := context.Background()
	if _, err := appPool.Exec(ctx, `SELECT count(*) FROM roomdate_app.users`); err != nil {
		t.Fatalf("il ruolo dell'applicazione deve leggere i dati: %v", err)
	}
	// Ogni prova gira in una transazione annullata alla fine: se un permesso ci fosse per errore,
	// il database resterebbe comunque intatto. Le tabelle scelte non sono referenziate da altre,
	// così un TRUNCATE fallisce solo per mancanza di permessi e non per le chiavi esterne.
	for _, statement := range []string{
		`DROP TABLE roomdate_app.message_keys`,
		`TRUNCATE roomdate_app.message_keys`,
		`TRUNCATE roomdate_app.security_events`,
		`ALTER TABLE roomdate_app.users ADD COLUMN intrusa integer`,
		`CREATE TABLE roomdate_app.intrusa (id integer)`,
		`CREATE INDEX intruso ON roomdate_app.users (bio)`,
		`CREATE TRIGGER intruso BEFORE INSERT ON roomdate_app.security_events FOR EACH ROW EXECUTE FUNCTION suppress_redundant_updates_trigger()`,
		`SELECT * FROM public.goose_db_version`,
		`DELETE FROM public.goose_db_version`,
	} {
		tx, err := appPool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		// 42501 (insufficient_privilege) vale sia per "permesso negato" sia per "bisogna essere
		// proprietari", in qualunque lingua sia configurato il server
		var pgErr *pgconn.PgError
		if _, err := tx.Exec(ctx, statement); err == nil {
			t.Errorf("il ruolo dell'applicazione non deve poter eseguire: %s", statement)
		} else if !errors.As(err, &pgErr) || pgErr.Code != "42501" {
			t.Errorf("%s è fallita per un altro motivo: %v", statement, err)
		}
		tx.Rollback(ctx)
	}
}

// "migrate grant-app" rifiuta i ruoli con privilegi in più dei soli dati, come quelli creati dalla
// console di Neon (membri di neon_superuser), e su un ruolo già pronto aggiorna solo i permessi.
func TestSetupAppRoleRefusesPrivilegedRoles(t *testing.T) {
	if appPool == nil {
		t.Skip("TEST_DATABASE_URL non impostata")
	}
	ctx := context.Background()
	owner := stdlib.OpenDB(*testPool.Config().ConnConfig.Copy())
	defer owner.Close()
	appRole := appPool.Config().ConnConfig.User

	if password, err := db.SetupAppRole(ctx, owner, appRole); err != nil || password != "" {
		t.Errorf("ruolo già pronto: password %q, errore %v", password, err)
	}
	if _, err := db.SetupAppRole(ctx, owner, testPool.Config().ConnConfig.User); err == nil || !strings.Contains(err.Error(), "sei collegato") {
		t.Errorf("il ruolo proprietario non deve diventare il ruolo dell'applicazione, errore %v", err)
	}

	for suffix, setup := range map[string]string{
		"_admin":  `CREATE ROLE %s LOGIN CREATEROLE`,
		"_db":     `CREATE ROLE %s LOGIN CREATEDB`,
		"_rls":    `CREATE ROLE %s LOGIN BYPASSRLS`,
		"_member": `CREATE ROLE %s LOGIN IN ROLE pg_read_all_data`,
	} {
		role := appRole + suffix
		ident := pgx.Identifier{role}.Sanitize()
		if _, err := testPool.Exec(ctx, strings.ReplaceAll(setup, "%s", ident)); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { dropRole(ctx, ident) })
		if _, err := db.SetupAppRole(ctx, owner, role); err == nil || !strings.Contains(err.Error(), "privilegi in più") {
			t.Errorf("%s: atteso il rifiuto, errore %v", role, err)
		}
	}

	// Un ruolo che possiede una tabella può modificarla o eliminarla
	role := appRole + "_owner"
	ident := pgx.Identifier{role}.Sanitize()
	for _, statement := range []string{
		`CREATE ROLE ` + ident + ` LOGIN`,
		`CREATE TABLE public.tabella_intrusa (id integer)`,
		`ALTER TABLE public.tabella_intrusa OWNER TO ` + ident,
	} {
		if _, err := testPool.Exec(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() { dropRole(ctx, ident) })
	if _, err := db.SetupAppRole(ctx, owner, role); err == nil || !strings.Contains(err.Error(), "privilegi in più") {
		t.Errorf("proprietario di una tabella: atteso il rifiuto, errore %v", err)
	}
}

// Se una tabella appartiene a un altro ruolo, GRANT non assegna nulla (dà solo un avviso):
// "migrate grant-app" deve fermarsi senza creare il ruolo, invece di lasciare l'app senza accesso.
func TestSetupAppRoleChecksEveryTable(t *testing.T) {
	if appPool == nil {
		t.Skip("TEST_DATABASE_URL non impostata")
	}
	ctx := context.Background()
	// Un proprietario che può cedere i permessi su tutto tranne che su message_keys e sulla sequenza
	// degli ID di security_events
	migrator := appPool.Config().ConnConfig.User + "_migr"
	ident := pgx.Identifier{migrator}.Sanitize()
	for _, statement := range []string{
		`CREATE ROLE ` + ident + ` LOGIN CREATEROLE PASSWORD 'prova-migrazioni'`,
		`GRANT USAGE ON SCHEMA roomdate_app TO ` + ident + ` WITH GRANT OPTION`,
		`GRANT ALL ON ALL TABLES IN SCHEMA roomdate_app TO ` + ident + ` WITH GRANT OPTION`,
		`GRANT ALL ON ALL SEQUENCES IN SCHEMA roomdate_app TO ` + ident + ` WITH GRANT OPTION`,
		`REVOKE GRANT OPTION FOR ALL ON roomdate_app.message_keys FROM ` + ident,
		`REVOKE GRANT OPTION FOR ALL ON SEQUENCE roomdate_app.security_events_id_seq FROM ` + ident,
	} {
		if _, err := testPool.Exec(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() { dropRole(ctx, ident) })

	cfg := testPool.Config().ConnConfig.Copy()
	cfg.User, cfg.Password = migrator, "prova-migrazioni"
	conn := stdlib.OpenDB(*cfg)
	defer conn.Close()

	role := appPool.Config().ConnConfig.User + "_partial"
	_, err := db.SetupAppRole(ctx, conn, role)
	if err == nil || !strings.Contains(err.Error(), "message_keys, security_events_id_seq") {
		t.Fatalf("atteso l'errore sui permessi di message_keys e della sequenza, errore %v", err)
	}
	var exists bool
	testPool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1)`, role).Scan(&exists)
	if exists {
		dropRole(ctx, pgx.Identifier{role}.Sanitize())
		t.Error("dopo l'errore il ruolo non deve restare creato")
	}
}

// dropRole elimina un ruolo di prova insieme a ciò che possiede e ai permessi ricevuti nel database
// di test, che altrimenti ne impedirebbero l'eliminazione.
func dropRole(ctx context.Context, ident string) {
	testPool.Exec(ctx, `DROP OWNED BY `+ident)
	testPool.Exec(ctx, `DROP ROLE `+ident)
}

// I vincoli del database fermano i dati sbagliati anche se il codice non li controllasse.
func TestDatabaseConstraints(t *testing.T) {
	app := newApp(t)
	u := app.registerUser("Anna", "affitta", true)
	listingID := app.createListing(u.Cookie, nil)
	ctx := context.Background()

	for _, statement := range []string{
		`UPDATE roomdate_app.users SET email = 'Anna@Test.it' WHERE id = '` + u.ID + `'`,
		`UPDATE roomdate_app.users SET user_type = 'admin' WHERE id = '` + u.ID + `'`,
		`UPDATE roomdate_app.users SET budget_max = 150000 WHERE id = '` + u.ID + `'`,
		`UPDATE roomdate_app.users SET bio = repeat('a', 1001) WHERE id = '` + u.ID + `'`,
		`UPDATE roomdate_app.users SET is_public = NULL WHERE id = '` + u.ID + `'`,
		`UPDATE roomdate_app.users SET kdf_iterations = 1000 WHERE id = '` + u.ID + `'`,
		`UPDATE roomdate_app.users SET recovery_hash = 'x', recovery_salt = NULL WHERE id = '` + u.ID + `'`,
		`UPDATE roomdate_app.listings SET title = '   ' WHERE id = ` + itoa(listingID),
		`UPDATE roomdate_app.listings SET description = repeat('a', 5001) WHERE id = ` + itoa(listingID),
	} {
		if _, err := appPool.Exec(ctx, statement); err == nil {
			t.Errorf("vincolo non applicato: %s", statement)
		}
	}
}
