-- Autenticazione robusta (modulo M3.2):
-- - le sessioni non stanno più in un token firmato dentro il cookie, ma in questa tabella:
--   il cookie contiene solo un numero casuale, di cui il database conserva l'impronta.
--   Così una sessione si può revocare davvero, e chi legge il database non può crearne di nuove;
-- - security_events registra accessi e operazioni delicate, e serve anche a rallentare
--   chi prova tante password (per indirizzo e per rete di provenienza).
--
-- Le sessioni aperte con il vecchio token restano nei browser ma non valgono più:
-- dopo questo aggiornamento tutti devono rifare l'accesso.

-- +goose Up
CREATE TABLE IF NOT EXISTS roomdate_app.sessions (
    id           UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL,
    -- Impronta SHA-256 del token: il token in chiaro esiste solo nel cookie del browser.
    token_hash   TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Scadenza assoluta: oltre questa data la sessione non vale più, anche se usata di continuo.
    expires_at   TIMESTAMPTZ NOT NULL,
    -- Descrizione del browser, per far riconoscere la sessione a chi la revoca.
    user_agent   TEXT,
    CONSTRAINT sessions_pkey PRIMARY KEY (id),
    CONSTRAINT sessions_token_hash_key UNIQUE (token_hash),
    CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES roomdate_app.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON roomdate_app.sessions (user_id, last_used_at DESC);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON roomdate_app.sessions (expires_at);

CREATE TABLE IF NOT EXISTS roomdate_app.security_events (
    id         BIGSERIAL,
    kind       TEXT NOT NULL,
    -- L'utente, quando è noto; resta NULL per i tentativi su indirizzi inesistenti.
    user_id    UUID,
    -- Impronte di email e indirizzo IP: servono solo a contare i tentativi recenti,
    -- e non permettono di risalire al valore originale.
    email_hash TEXT,
    ip_hash    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT security_events_pkey PRIMARY KEY (id),
    CONSTRAINT security_events_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES roomdate_app.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS security_events_email_idx
    ON roomdate_app.security_events (email_hash, created_at DESC) WHERE kind = 'login_failed';
CREATE INDEX IF NOT EXISTS security_events_ip_idx
    ON roomdate_app.security_events (ip_hash, created_at DESC) WHERE kind = 'login_failed';
CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON roomdate_app.security_events (created_at);

-- Il blocco dell'account dopo cinque tentativi viene sostituito da attese crescenti:
-- bloccare l'account permetteva a chiunque di chiudere fuori un utente conoscendone l'email.
UPDATE roomdate_app.users SET failed_login_attempts = 0, locked_until = NULL
WHERE COALESCE(failed_login_attempts, 0) <> 0 OR locked_until IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS roomdate_app.security_events;
DROP TABLE IF EXISTS roomdate_app.sessions;
