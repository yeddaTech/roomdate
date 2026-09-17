package server_test

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"

	"roomdate-backend/internal/db"
)

// La migrazione 00004 converte i profili salvati dalle versioni precedenti dell'app.
func TestMigrationConvertsLegacyProfiles(t *testing.T) {
	if testPool == nil {
		t.Skip("TEST_DATABASE_URL non impostata")
	}
	ctx := context.Background()
	suffix := make([]byte, 4)
	rand.Read(suffix)
	name := pgx.Identifier{"roomdate_migration_" + hex.EncodeToString(suffix)}.Sanitize()
	if _, err := testPool.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { testPool.Exec(ctx, "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)") })

	cfg := testPool.Config().ConnConfig.Copy()
	cfg.Database = name[1 : len(name)-1]
	conn := stdlib.OpenDB(*cfg)
	defer conn.Close()

	if err := db.Migrate(ctx, conn, "up-to", "3"); err != nil {
		t.Fatal(err)
	}
	_, err := conn.ExecContext(ctx, `
        INSERT INTO roomdate_app.users (email, password_hash, first_name, citta, occupation, lifestyle_tags) VALUES
            ('Anna@Test.it ', 'x', 'Anna', 'milano ', 'Studente', 'Non Fumatore, Ho animali, Ordinato/a'),
            ('bruno@test.it', 'x', 'Bruno', 'Forli', 'misto', '🚬 Fumatore, Non, Ho, Socievole'),
            ('carla@test.it', 'x', 'Carla', 'Sesto San Giovanni', 'lavoratore', 'Vegano/Vegetariano, Sportivo, ,'),
            ('dario@test.it', 'x', 'Dario', '', 'astronauta', NULL);
        INSERT INTO roomdate_app.listings (user_id, title, city, price, room_type)
        SELECT id, 'Stanza', 'ROMA', 400, 'singola' FROM roomdate_app.users WHERE first_name = 'Anna'`)
	if err != nil {
		t.Fatal(err)
	}

	if err := db.Migrate(ctx, conn, "up"); err != nil {
		t.Fatal(err)
	}

	want := map[string][4]string{
		"Anna":  {"anna@test.it", "Milano", "studente", "{non_fumatore,animali,ordinato}"},
		"Bruno": {"bruno@test.it", "Forlì", "studente_lavoratore", "{animali,socievole}"},
		"Carla": {"carla@test.it", "Sesto San Giovanni", "lavoratore", "{vegetariano}"},
		"Dario": {"dario@test.it", "", "", "{}"},
	}
	rows, err := conn.QueryContext(ctx, `
        SELECT first_name, email, COALESCE(citta, ''), COALESCE(occupation, ''), lifestyle_tags::text FROM roomdate_app.users`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var firstName string
		var got [4]string
		if err := rows.Scan(&firstName, &got[0], &got[1], &got[2], &got[3]); err != nil {
			t.Fatal(err)
		}
		if got != want[firstName] {
			t.Errorf("%s = %q, atteso %q", firstName, got, want[firstName])
		}
	}

	var city string
	conn.QueryRowContext(ctx, `SELECT city FROM roomdate_app.listings`).Scan(&city)
	if city != "Roma" {
		t.Errorf("città dell'annuncio = %q", city)
	}
}
