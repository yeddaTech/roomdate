-- Moderazione e privacy (modulo M3.3): blocchi tra utenti, segnalazioni, un ruolo admin minimo
-- e la sospensione degli account, che i Termini prevedono ma finora non si potevano applicare.
-- Solo tabelle e colonne nuove, con valori predefiniti: il codice precedente continua a funzionare.

-- +goose Up
ALTER TABLE roomdate_app.users
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    -- Account sospeso dalla moderazione: non può accedere e sparisce da ricerche e profili
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Annuncio rimosso dalla moderazione: resta visibile solo al proprietario, che può eliminarlo
-- ma non riattivarlo né modificarlo
ALTER TABLE roomdate_app.listings ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS roomdate_app.user_blocks (
    blocker_id UUID NOT NULL REFERENCES roomdate_app.users (id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES roomdate_app.users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT user_blocks_not_self_check CHECK (blocker_id <> blocked_id)
);
-- Il blocco vale nei due sensi: serve cercarlo anche dalla parte di chi è bloccato
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON roomdate_app.user_blocks (blocked_id);

CREATE TABLE IF NOT EXISTS roomdate_app.reports (
    id                BIGSERIAL PRIMARY KEY,
    -- Chi segnala: se elimina l'account la segnalazione resta, senza autore
    reporter_id       UUID REFERENCES roomdate_app.users (id) ON DELETE SET NULL,
    -- L'utente segnalato, o il proprietario dell'annuncio segnalato. Se elimina l'account non c'è
    -- più nulla da moderare e la segnalazione sparisce con lui
    target_user_id    UUID NOT NULL REFERENCES roomdate_app.users (id) ON DELETE CASCADE,
    listing_id        INTEGER REFERENCES roomdate_app.listings (id) ON DELETE SET NULL,
    reason            TEXT NOT NULL,
    details           TEXT NOT NULL DEFAULT '',
    -- Messaggi della chat allegati da chi segnala, già decifrati nel suo browser: il server non può
    -- leggerli altrimenti. [{"text": "...", "sentAt": "..."}]
    evidence          JSONB,
    status            TEXT NOT NULL DEFAULT 'open',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at       TIMESTAMPTZ,
    resolved_by       UUID REFERENCES roomdate_app.users (id) ON DELETE SET NULL,
    resolution        TEXT,
    CONSTRAINT reports_reason_check CHECK (reason IN ('fake_listing', 'scam', 'discrimination', 'harassment', 'spam', 'other')),
    CONSTRAINT reports_details_length_check CHECK (char_length(details) <= 1000),
    CONSTRAINT reports_status_check CHECK (status IN ('open', 'dismissed', 'resolved')),
    CONSTRAINT reports_resolution_check CHECK ((status = 'open') = (resolved_at IS NULL)),
    CONSTRAINT reports_not_self_check CHECK (reporter_id IS NULL OR reporter_id <> target_user_id)
);
-- Una sola segnalazione aperta per chi segnala e cosa segnala: un doppio invio non crea duplicati
CREATE UNIQUE INDEX IF NOT EXISTS reports_open_unique_idx
    ON roomdate_app.reports (reporter_id, target_user_id, COALESCE(listing_id, 0)) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS reports_open_idx ON roomdate_app.reports (created_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS reports_target_idx ON roomdate_app.reports (target_user_id);
-- Limite di segnalazioni per utente e pulizia di quelle chiuse
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON roomdate_app.reports (reporter_id, created_at);
CREATE INDEX IF NOT EXISTS reports_resolved_idx ON roomdate_app.reports (resolved_at) WHERE resolved_at IS NOT NULL;

-- Da ora la registrazione richiede 18 anni compiuti. Gli account già esistenti non vengono toccati:
-- la migrazione segnala solo quanti sono, da verificare a mano.
-- +goose StatementBegin
DO $$
DECLARE
    minors BIGINT;
BEGIN
    SELECT count(*) INTO minors FROM roomdate_app.users WHERE birthdate > CURRENT_DATE - INTERVAL '18 years';
    IF minors > 0 THEN
        RAISE WARNING 'Account con meno di 18 anni secondo la data di nascita: %', minors;
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
DROP TABLE IF EXISTS roomdate_app.reports;
DROP TABLE IF EXISTS roomdate_app.user_blocks;
ALTER TABLE roomdate_app.listings DROP COLUMN IF EXISTS removed_at;
ALTER TABLE roomdate_app.users DROP COLUMN IF EXISTS suspended_at, DROP COLUMN IF EXISTS is_admin;
