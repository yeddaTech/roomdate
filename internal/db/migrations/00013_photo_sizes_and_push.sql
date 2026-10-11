-- Qualità e app installabile (modulo M2.8). Solo aggiunte: il codice precedente continua a
-- funzionare con il database migrato, quindi prima la migrazione e poi il deploy.

-- +goose Up
-- Larghezze delle versioni ridotte di ogni foto (es. {480,960}), che il browser crea al
-- caricamento accanto all'originale: le pagine scelgono la più adatta allo schermo (srcset).
-- Vuoto per le foto caricate prima, che restano solo nella misura originale.
ALTER TABLE roomdate_app.listing_images
    ADD COLUMN IF NOT EXISTS widths INTEGER[] NOT NULL DEFAULT '{}';

-- Iscrizioni alle notifiche push: una per browser in cui l'utente le ha attivate. L'indirizzo
-- (endpoint) è del servizio push del browser; p256dh e auth cifrano il contenuto per quel browser.
CREATE TABLE IF NOT EXISTS roomdate_app.push_subscriptions (
    id         BIGSERIAL PRIMARY KEY,
    -- Eliminando l'account le iscrizioni spariscono con lui
    user_id    UUID NOT NULL REFERENCES roomdate_app.users (id) ON DELETE CASCADE,
    -- La sessione di quel browser: uscendo, o chiudendo la sessione da un altro dispositivo, lì
    -- gli avvisi smettono di arrivare
    session_id UUID NOT NULL REFERENCES roomdate_app.sessions (id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000),
    p256dh     TEXT NOT NULL CHECK (char_length(p256dh) <= 200),
    auth       TEXT NOT NULL CHECK (char_length(auth) <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON roomdate_app.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_session_idx ON roomdate_app.push_subscriptions (session_id);

-- +goose Down
DROP TABLE IF EXISTS roomdate_app.push_subscriptions;
ALTER TABLE roomdate_app.listing_images DROP COLUMN IF EXISTS widths;
