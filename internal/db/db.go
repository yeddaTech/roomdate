package db

import (
	"context"
	"database/sql"
	"errors"
	"log"
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
	cfg.OnNotice = func(_ *pgconn.PgConn, n *pgconn.Notice) {
		if n.Severity == "WARNING" {
			log.Printf("Avviso del database: %s", n.Message)
		}
	}
	return stdlib.OpenDB(*cfg), nil
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
