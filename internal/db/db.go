package db

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// Config interpreta la stringa di connessione e applica le impostazioni del pool.
func Config(databaseURL string) (*pgxpool.Config, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	requireVerifiedTLS(cfg.ConnConfig)
	// Compatibile con il pooler di Neon (PgBouncer in transaction mode):
	// niente prepared statement con nome, solo la descrizione delle query in cache.
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeCacheDescribe
	// Poche connessioni per istanza: su Vercel ogni funzione ha il suo pool.
	cfg.MaxConns = 5
	cfg.MaxConnIdleTime = time.Minute
	return cfg, nil
}

// Open crea il pool. Non apre connessioni finché non serve la prima query.
func Open(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := Config(databaseURL)
	if err != nil {
		return nil, err
	}
	return pgxpool.NewWithConfig(ctx, cfg)
}

// OpenSQL apre una connessione database/sql con il driver pgx (per goose e il seed).
// Gli avvisi WARNING del database (ad esempio quelli delle migrazioni) finiscono nel log;
// i semplici NOTICE (come "does not exist, skipping") no.
func OpenSQL(databaseURL string) (*sql.DB, error) {
	cfg, err := pgx.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	requireVerifiedTLS(cfg)
	cfg.OnNotice = func(_ *pgconn.PgConn, n *pgconn.Notice) {
		if n.Severity == "WARNING" {
			log.Printf("Avviso del database: %s", n.Message)
		}
	}
	return stdlib.OpenDB(*cfg), nil
}

// requireVerifiedTLS impone, verso qualsiasi host non locale, TLS con verifica del certificato e del
// nome del server (sslmode=verify-full), qualunque cosa dica la stringa di connessione.
// Con sslmode=require, il valore predefinito di Neon, la connessione è cifrata ma il certificato
// non viene controllato: chi si mettesse in mezzo potrebbe fingersi il database.
// Nessun ripiego senza TLS (sslmode=prefer lo prevede).
func requireVerifiedTLS(cfg *pgx.ConnConfig) {
	if isLocalHost(cfg.Host) {
		return
	}
	cfg.TLSConfig = &tls.Config{ServerName: cfg.Host, MinVersion: tls.VersionTLS12}
	cfg.Fallbacks = nil
}

// isLocalHost indica una connessione sulla stessa macchina: socket Unix o indirizzo di loopback.
func isLocalHost(host string) bool {
	return host == "" || strings.HasPrefix(host, "/") || host == "localhost" || host == "127.0.0.1" || host == "::1"
}

// SetupAppRole prepara il ruolo usato dall'applicazione, con i soli permessi sui dati: leggere e
// scrivere le righe delle tabelle di roomdate_app. Niente creazione o modifica delle tabelle, niente
// TRUNCATE, niente accesso alla tabella delle migrazioni: se qualcuno sfruttasse un errore del codice,
// non potrebbe cambiare lo schema. Va eseguita dal ruolo che fa le migrazioni: con ALTER DEFAULT
// PRIVILEGES anche le tabelle create dalle migrazioni future ricevono gli stessi permessi.
//
// Se il ruolo non esiste lo crea, con una password casuale che restituisce (e che non viene salvata
// da nessuna parte); per un ruolo esistente aggiorna solo i permessi e restituisce "".
// Rifiuta un ruolo con privilegi in più, come quelli creati dalla console di Neon, che fanno parte
// di neon_superuser e possono leggere e scrivere qualsiasi tabella o creare altri ruoli.
func SetupAppRole(ctx context.Context, conn *sql.DB, role string) (password string, err error) {
	var exists, isCurrent, privileged bool
	err = conn.QueryRowContext(ctx, `
		SELECT r.oid IS NOT NULL, $1 = current_user,
		       COALESCE(r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls
		                OR EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid)
		                OR EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspowner = r.oid)
		                OR EXISTS (SELECT 1 FROM pg_class c WHERE c.relowner = r.oid), FALSE)
		FROM (SELECT 1) AS one LEFT JOIN pg_roles r ON r.rolname = $1`, role).Scan(&exists, &isCurrent, &privileged)
	if err != nil {
		return "", err
	}
	if isCurrent {
		return "", fmt.Errorf("%q è il ruolo con cui sei collegato: il ruolo dell'applicazione deve essere un altro", role)
	}
	if privileged {
		return "", fmt.Errorf("il ruolo %q ha privilegi in più dei soli dati (è amministratore, può creare ruoli o database, possiede tabelle "+
			"o fa parte di altri ruoli, come neon_superuser per i ruoli creati dalla console di Neon): "+
			"scegli un nome nuovo e lascia che lo crei questo comando", role)
	}

	ident := pgx.Identifier{role}.Sanitize()
	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	if !exists {
		secret := make([]byte, 24)
		if _, err := rand.Read(secret); err != nil {
			return "", err
		}
		// Solo lettere, cifre, "-" e "_": si può scrivere così com'è sia nell'SQL sia in un URL
		password = base64.RawURLEncoding.EncodeToString(secret)
		if _, err := tx.ExecContext(ctx, "CREATE ROLE "+ident+" LOGIN PASSWORD '"+password+"'"); err != nil {
			return "", fmt.Errorf("creazione del ruolo: %w", err)
		}
	}
	for _, statement := range []string{
		`GRANT USAGE ON SCHEMA roomdate_app TO ` + ident,
		`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA roomdate_app TO ` + ident,
		`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA roomdate_app TO ` + ident,
		`ALTER DEFAULT PRIVILEGES IN SCHEMA roomdate_app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ` + ident,
		`ALTER DEFAULT PRIVILEGES IN SCHEMA roomdate_app GRANT USAGE, SELECT ON SEQUENCES TO ` + ident,
	} {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return "", fmt.Errorf("%s: %w", statement, err)
		}
	}
	// Su una tabella di un altro proprietario GRANT non assegna nulla e dà solo un avviso:
	// meglio fermarsi qui che scoprirlo quando l'app non riesce a leggere i dati
	var missing sql.NullString
	err = tx.QueryRowContext(ctx, `
		SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
		FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'roomdate_app' AND CASE
		    WHEN c.relkind IN ('r', 'p') THEN NOT (has_table_privilege($1, c.oid, 'SELECT') AND has_table_privilege($1, c.oid, 'INSERT')
		        AND has_table_privilege($1, c.oid, 'UPDATE') AND has_table_privilege($1, c.oid, 'DELETE'))
		    WHEN c.relkind = 'S' THEN NOT has_sequence_privilege($1, c.oid, 'USAGE')
		    ELSE FALSE END`, role).Scan(&missing)
	if err != nil {
		return "", err
	}
	if missing.Valid {
		return "", fmt.Errorf("permessi non assegnati su %s: il ruolo con cui sei collegato non ne è il proprietario", missing.String)
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	return password, nil
}

// Migrate esegue un comando di goose (up, down, status...) con le migrazioni incluse nel binario.
func Migrate(ctx context.Context, conn *sql.DB, command string, args ...string) error {
	goose.SetBaseFS(Migrations)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.RunContext(ctx, command, conn, "migrations", args...)
}

// IsUniqueViolation indica la violazione di un vincolo di unicità (es. email già registrata).
func IsUniqueViolation(err error) bool {
	return hasCode(err, "23505")
}

// IsForeignKeyViolation indica un riferimento a una riga inesistente o ancora referenziata.
func IsForeignKeyViolation(err error) bool {
	return hasCode(err, "23503")
}

// IsInvalidInput indica un valore non convertibile nel tipo della colonna
// (es. "abc" come ID numerico): per chi chiama equivale a "non trovato".
func IsInvalidInput(err error) bool {
	return hasCode(err, "22P02")
}

// IsNoRows indica che la query non ha restituito righe.
func IsNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}

func hasCode(err error, code string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == code
}
