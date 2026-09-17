-- Chat stabile e scalabile (modulo M1.7):
-- - tabella dei partecipanti con "letto fino a", per contare i messaggi non letti;
-- - chiave di deduplicazione: due click sullo stesso annuncio non creano due conversazioni (F13);
-- - messaggi con cifratura ibrida: un solo testo cifrato con AES-GCM e, per ogni partecipante,
--   la chiave del messaggio cifrata con RSA. Sparisce il limite di 190 byte per messaggio (F8);
-- - date e orari in UTC con fuso esplicito, così il browser può mostrarli nell'ora locale (F11).
--
-- I messaggi già scritti restano leggibili: hanno formato 1 (una copia cifrata per destinatario
-- e una per il mittente) e vengono letti dalle vecchie colonne.

-- +goose Up
-- Gli orari erano salvati senza fuso: sono già in UTC, lo si dichiara.
ALTER TABLE roomdate_app.conversations
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE roomdate_app.messages
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN created_at SET DEFAULT NOW();

CREATE TABLE IF NOT EXISTS roomdate_app.conversation_participants (
    conversation_id INTEGER NOT NULL,
    user_id         UUID NOT NULL,
    -- Messaggi fino a questo istante considerati letti; NULL se non è mai stata aperta.
    last_read_at    TIMESTAMPTZ,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id),
    CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id)
        REFERENCES roomdate_app.conversations (id) ON DELETE CASCADE,
    CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES roomdate_app.users (id) ON DELETE CASCADE
);

-- Le conversazioni esistenti hanno i partecipanti nelle colonne tenant_id e user2_id.
-- I messaggi già scambiati valgono come letti: quanto fosse già stato letto non è mai stato registrato.
INSERT INTO roomdate_app.conversation_participants (conversation_id, user_id, last_read_at, joined_at)
SELECT c.id, p.user_id, NOW(), COALESCE(c.created_at, NOW())
FROM roomdate_app.conversations c
CROSS JOIN LATERAL (VALUES (c.tenant_id), (c.user2_id)) AS p(user_id)
WHERE p.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx
    ON roomdate_app.conversation_participants (user_id);

-- Chiave di deduplicazione: una conversazione per annuncio e inquilino, una per coppia di utenti.
-- Le conversazioni rimaste senza partecipanti (account eliminati) tengono una chiave tutta loro.
ALTER TABLE roomdate_app.conversations ADD COLUMN IF NOT EXISTS dedup_key TEXT;

UPDATE roomdate_app.conversations
SET dedup_key = CASE
    WHEN listing_id IS NOT NULL AND tenant_id IS NOT NULL THEN 'listing:' || listing_id || ':' || tenant_id
    WHEN listing_id IS NULL AND tenant_id IS NOT NULL AND user2_id IS NOT NULL
        THEN 'direct:' || least(tenant_id::text, user2_id::text) || ':' || greatest(tenant_id::text, user2_id::text)
    ELSE 'conversation:' || id
END
WHERE dedup_key IS NULL;

-- Eventuali doppioni già presenti tengono la chiave solo sulla conversazione più vecchia:
-- le altre restano dove sono, ma non ne nasceranno di nuove.
UPDATE roomdate_app.conversations c
SET dedup_key = 'conversation:' || c.id
WHERE EXISTS (
    SELECT 1 FROM roomdate_app.conversations older
    WHERE older.dedup_key = c.dedup_key AND older.id < c.id
);

ALTER TABLE roomdate_app.conversations ALTER COLUMN dedup_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_dedup_key_idx ON roomdate_app.conversations (dedup_key);

-- Messaggi: formato 1 = una copia cifrata per ciascuno (fino a 190 byte), 2 = cifratura ibrida.
ALTER TABLE roomdate_app.messages
    ADD COLUMN IF NOT EXISTS format SMALLINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS body TEXT,
    ADD COLUMN IF NOT EXISTS iv TEXT;

CREATE TABLE IF NOT EXISTS roomdate_app.message_keys (
    message_id  INTEGER NOT NULL,
    user_id     UUID NOT NULL,
    -- Chiave AES del messaggio, cifrata con la chiave pubblica del partecipante.
    wrapped_key TEXT NOT NULL,
    CONSTRAINT message_keys_pkey PRIMARY KEY (message_id, user_id),
    CONSTRAINT message_keys_message_id_fkey FOREIGN KEY (message_id)
        REFERENCES roomdate_app.messages (id) ON DELETE CASCADE,
    CONSTRAINT message_keys_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES roomdate_app.users (id) ON DELETE CASCADE
);

DROP INDEX IF EXISTS roomdate_app.messages_conversation_id_created_at_idx;
CREATE INDEX IF NOT EXISTS messages_conversation_recent_idx
    ON roomdate_app.messages (conversation_id, created_at DESC, id DESC);

-- +goose Down
DROP TABLE IF EXISTS roomdate_app.message_keys;
DROP TABLE IF EXISTS roomdate_app.conversation_participants;
DROP INDEX IF EXISTS roomdate_app.conversations_dedup_key_idx;
DROP INDEX IF EXISTS roomdate_app.messages_conversation_recent_idx;

ALTER TABLE roomdate_app.conversations DROP COLUMN IF EXISTS dedup_key;
ALTER TABLE roomdate_app.messages
    DROP COLUMN IF EXISTS format,
    DROP COLUMN IF EXISTS body,
    DROP COLUMN IF EXISTS iv;

CREATE INDEX IF NOT EXISTS messages_conversation_id_created_at_idx
    ON roomdate_app.messages (conversation_id, created_at);

ALTER TABLE roomdate_app.conversations ALTER COLUMN created_at TYPE TIMESTAMP;
ALTER TABLE roomdate_app.messages ALTER COLUMN created_at TYPE TIMESTAMP;
