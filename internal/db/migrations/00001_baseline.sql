-- Schema di base di Roomdate, ricostruito dalle query del backend (settembre 2026).
--
-- ⚠️ Prima di eseguirlo sul database di produzione, confrontalo con lo schema reale:
--      pg_dump --schema-only --schema=roomdate_app "$DATABASE_URL"
-- e correggi questo file se ci sono differenze (tipi degli ID, vincoli, colonne).
--
-- Tutte le istruzioni usano IF NOT EXISTS: in produzione, dove le tabelle esistono già,
-- la migrazione non cambia nulla e registra solo il punto di partenza.
-- Su un database vuoto (sviluppo, branch Neon) crea lo schema completo.

-- +goose Up
CREATE SCHEMA IF NOT EXISTS roomdate_app;

CREATE TABLE IF NOT EXISTS roomdate_app.users (
    id                    SERIAL PRIMARY KEY,
    first_name            TEXT NOT NULL,
    last_name             TEXT NOT NULL,
    email                 TEXT NOT NULL UNIQUE,
    password_hash         TEXT NOT NULL,
    citta                 TEXT,
    user_type             TEXT,
    birthdate             DATE,
    budget_max            INTEGER,
    occupation            TEXT,
    bio                   TEXT,
    lifestyle_tags        TEXT,
    is_public             BOOLEAN DEFAULT TRUE,
    public_key            TEXT,
    encrypted_private_key TEXT,
    crypto_salt           TEXT,
    crypto_iv             TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS roomdate_app.listings (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES roomdate_app.users (id),
    title       TEXT NOT NULL,
    city        TEXT NOT NULL,
    zone        TEXT,
    room_type   TEXT NOT NULL,
    price       INTEGER NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat su un annuncio: listing_id + tenant_id (il proprietario si ricava dall'annuncio).
-- Chat diretta: listing_id NULL, tenant_id (chi la avvia) + user2_id.
CREATE TABLE IF NOT EXISTS roomdate_app.conversations (
    id         SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES roomdate_app.listings (id),
    tenant_id  INTEGER NOT NULL REFERENCES roomdate_app.users (id),
    user2_id   INTEGER REFERENCES roomdate_app.users (id)
);

-- content: cifrato per il destinatario; sender_content: cifrato per il mittente.
CREATE TABLE IF NOT EXISTS roomdate_app.messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES roomdate_app.conversations (id),
    sender_id       INTEGER NOT NULL REFERENCES roomdate_app.users (id),
    content         TEXT NOT NULL,
    sender_content  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
-- Nessun rollback: eliminare lo schema di base cancellerebbe tutti i dati.
SELECT 1;
