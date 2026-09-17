-- Schema di base di Roomdate: copia dello schema reale di produzione
-- (pg_dump --schema-only --schema=roomdate_app, verificato il 17 settembre 2026).
--
-- Tutte le istruzioni usano IF NOT EXISTS: in produzione, dove le tabelle esistono già,
-- la migrazione non cambia nulla e registra solo il punto di partenza.
-- Su un database vuoto (sviluppo, test, branch Neon) crea lo stesso schema della produzione.

-- +goose Up
CREATE SCHEMA IF NOT EXISTS roomdate_app;

CREATE TABLE IF NOT EXISTS roomdate_app.users (
    id                    UUID DEFAULT gen_random_uuid() NOT NULL,
    email                 VARCHAR(255) NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    first_name            VARCHAR(100),
    last_name             VARCHAR(100),
    created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    occupation            VARCHAR(50),
    birthdate             DATE,
    bio                   TEXT,
    lifestyle_tags        TEXT,
    user_type             VARCHAR(20) DEFAULT 'cerca',
    citta                 VARCHAR(100),
    budget_max            INTEGER DEFAULT 0,
    is_public             BOOLEAN DEFAULT TRUE,
    public_key            TEXT,
    encrypted_private_key TEXT,
    crypto_salt           TEXT,
    crypto_iv             TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until          TIMESTAMPTZ,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS roomdate_app.listings (
    id          SERIAL,
    user_id     UUID,
    title       VARCHAR(100) NOT NULL,
    city        VARCHAR(50) NOT NULL,
    zone        VARCHAR(100),
    room_type   VARCHAR(50),
    price       INTEGER NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT listings_pkey PRIMARY KEY (id),
    CONSTRAINT listings_user_id_fkey FOREIGN KEY (user_id) REFERENCES roomdate_app.users (id)
);

-- Chat su un annuncio: listing_id + tenant_id (chi la avvia). Chat diretta: tenant_id + user2_id.
CREATE TABLE IF NOT EXISTS roomdate_app.conversations (
    id         SERIAL,
    listing_id INTEGER,
    tenant_id  UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user2_id   UUID,
    CONSTRAINT conversations_pkey PRIMARY KEY (id),
    CONSTRAINT conversations_listing_id_tenant_id_key UNIQUE (listing_id, tenant_id),
    CONSTRAINT conversations_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES roomdate_app.listings (id) ON DELETE CASCADE,
    CONSTRAINT conversations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES roomdate_app.users (id) ON DELETE CASCADE,
    CONSTRAINT conversations_user2_id_fkey FOREIGN KEY (user2_id) REFERENCES roomdate_app.users (id)
);

-- content: cifrato per il destinatario; sender_content: cifrato per il mittente.
CREATE TABLE IF NOT EXISTS roomdate_app.messages (
    id              SERIAL,
    conversation_id INTEGER,
    sender_id       UUID,
    content         TEXT NOT NULL,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sender_content  TEXT,
    CONSTRAINT messages_pkey PRIMARY KEY (id),
    CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES roomdate_app.conversations (id) ON DELETE CASCADE,
    CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES roomdate_app.users (id) ON DELETE CASCADE
);

-- +goose Down
-- Nessun rollback: eliminare lo schema di base cancellerebbe tutti i dati.
SELECT 1;
