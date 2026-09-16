-- Annunci su dati reali (modulo M1.4):
-- - nuovi campi degli annunci e tabella delle foto;
-- - vincoli su prezzo e tipo di stanza;
-- - chiavi esterne con ON DELETE esplicito, così eliminare un annuncio o un account non fallisce più (F16):
--     * account eliminato → i suoi annunci spariscono, le conversazioni e i messaggi restano
--       all'altro partecipante, con l'utente mostrato come "Utente eliminato";
--     * annuncio eliminato → le conversazioni restano tra i due partecipanti.
--
-- In produzione nomi e presenza delle chiavi esterne non sono noti (lo schema di base è stato
-- ricostruito): quelle esistenti vengono trovate per colonna e ricreate. Vincoli e chiavi esterne
-- nascono NOT VALID e vengono convalidati subito; se i dati esistenti non li rispettano restano
-- NOT VALID (valgono comunque per le nuove righe) e la migrazione lo segnala con un WARNING.

-- +goose Up
ALTER TABLE roomdate_app.listings
    ADD COLUMN IF NOT EXISTS amenities      TEXT[]      NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS bills_included BOOLEAN,
    ADD COLUMN IF NOT EXISTS available_from DATE,
    ADD COLUMN IF NOT EXISTS is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE roomdate_app.listings SET room_type = lower(trim(room_type)) WHERE room_type <> lower(trim(room_type));

CREATE TABLE IF NOT EXISTS roomdate_app.listing_images (
    id          SERIAL PRIMARY KEY,
    listing_id  INTEGER NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    position    INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Le chat su un annuncio registrano anche il proprietario in user2_id: la conversazione non dipende
-- più dall'esistenza dell'annuncio.
UPDATE roomdate_app.conversations c
SET user2_id = l.user_id
FROM roomdate_app.listings l
WHERE c.listing_id = l.id AND c.user2_id IS NULL;

-- Chi ha eliminato l'account lascia conversazioni e messaggi senza autore
ALTER TABLE roomdate_app.conversations ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE roomdate_app.messages ALTER COLUMN sender_id DROP NOT NULL;

-- Rimuove le chiavi esterne esistenti sulle colonne interessate, qualunque sia il loro nome
-- +goose StatementBegin
DO $$
DECLARE
    fk RECORD;
BEGIN
    FOR fk IN
        SELECT c.conname, c.conrelid::regclass AS tbl
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f'
          AND cardinality(c.conkey) = 1
          AND (c.conrelid, a.attname::text) IN (
              ('roomdate_app.listings'::regclass, 'user_id'),
              ('roomdate_app.listing_images'::regclass, 'listing_id'),
              ('roomdate_app.conversations'::regclass, 'listing_id'),
              ('roomdate_app.conversations'::regclass, 'tenant_id'),
              ('roomdate_app.conversations'::regclass, 'user2_id'),
              ('roomdate_app.messages'::regclass, 'conversation_id'),
              ('roomdate_app.messages'::regclass, 'sender_id')
          )
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tbl, fk.conname);
    END LOOP;
END $$;
-- +goose StatementEnd

ALTER TABLE roomdate_app.listings
    DROP CONSTRAINT IF EXISTS listings_price_check,
    DROP CONSTRAINT IF EXISTS listings_room_type_check,
    ADD CONSTRAINT listings_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES roomdate_app.users (id) ON DELETE CASCADE NOT VALID,
    ADD CONSTRAINT listings_price_check CHECK (price BETWEEN 1 AND 20000) NOT VALID,
    ADD CONSTRAINT listings_room_type_check CHECK (room_type IN ('singola', 'doppia')) NOT VALID;

ALTER TABLE roomdate_app.listing_images
    ADD CONSTRAINT listing_images_listing_id_fkey FOREIGN KEY (listing_id)
        REFERENCES roomdate_app.listings (id) ON DELETE CASCADE NOT VALID;

ALTER TABLE roomdate_app.conversations
    ADD CONSTRAINT conversations_listing_id_fkey FOREIGN KEY (listing_id)
        REFERENCES roomdate_app.listings (id) ON DELETE SET NULL NOT VALID,
    ADD CONSTRAINT conversations_tenant_id_fkey FOREIGN KEY (tenant_id)
        REFERENCES roomdate_app.users (id) ON DELETE SET NULL NOT VALID,
    ADD CONSTRAINT conversations_user2_id_fkey FOREIGN KEY (user2_id)
        REFERENCES roomdate_app.users (id) ON DELETE SET NULL NOT VALID;

ALTER TABLE roomdate_app.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id)
        REFERENCES roomdate_app.conversations (id) ON DELETE CASCADE NOT VALID,
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id)
        REFERENCES roomdate_app.users (id) ON DELETE SET NULL NOT VALID;

-- Convalida i vincoli sui dati esistenti; quelli violati restano NOT VALID con un avviso
-- +goose StatementBegin
DO $$
DECLARE
    item TEXT[];
BEGIN
    FOREACH item SLICE 1 IN ARRAY ARRAY[
        ['roomdate_app.listings', 'listings_user_id_fkey'],
        ['roomdate_app.listings', 'listings_price_check'],
        ['roomdate_app.listings', 'listings_room_type_check'],
        ['roomdate_app.listing_images', 'listing_images_listing_id_fkey'],
        ['roomdate_app.conversations', 'conversations_listing_id_fkey'],
        ['roomdate_app.conversations', 'conversations_tenant_id_fkey'],
        ['roomdate_app.conversations', 'conversations_user2_id_fkey'],
        ['roomdate_app.messages', 'messages_conversation_id_fkey'],
        ['roomdate_app.messages', 'messages_sender_id_fkey']
    ]
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', item[1], item[2]);
        EXCEPTION WHEN check_violation OR foreign_key_violation THEN
            RAISE WARNING 'Vincolo % lasciato NOT VALID: i dati esistenti non lo rispettano (%)', item[2], SQLERRM;
        END;
    END LOOP;
END $$;
-- +goose StatementEnd

-- Indici per le chiavi esterne (eliminazioni a cascata) e per gli elenchi
CREATE INDEX IF NOT EXISTS listings_user_id_idx ON roomdate_app.listings (user_id);
CREATE INDEX IF NOT EXISTS listings_active_created_at_idx ON roomdate_app.listings (created_at DESC) WHERE is_active;
CREATE INDEX IF NOT EXISTS listing_images_listing_id_position_idx ON roomdate_app.listing_images (listing_id, position);
CREATE INDEX IF NOT EXISTS conversations_listing_id_idx ON roomdate_app.conversations (listing_id);
CREATE INDEX IF NOT EXISTS conversations_tenant_id_idx ON roomdate_app.conversations (tenant_id);
CREATE INDEX IF NOT EXISTS conversations_user2_id_idx ON roomdate_app.conversations (user2_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_created_at_idx ON roomdate_app.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON roomdate_app.messages (sender_id);

-- +goose Down
-- Ripristina le chiavi esterne senza azioni ON DELETE. tenant_id e sender_id restano nullable:
-- dopo delle eliminazioni potrebbero contenere NULL. user2_id sulle chat degli annunci resta valorizzato.
DROP INDEX IF EXISTS roomdate_app.listings_user_id_idx;
DROP INDEX IF EXISTS roomdate_app.listings_active_created_at_idx;
DROP INDEX IF EXISTS roomdate_app.conversations_listing_id_idx;
DROP INDEX IF EXISTS roomdate_app.conversations_tenant_id_idx;
DROP INDEX IF EXISTS roomdate_app.conversations_user2_id_idx;
DROP INDEX IF EXISTS roomdate_app.messages_conversation_id_created_at_idx;
DROP INDEX IF EXISTS roomdate_app.messages_sender_id_idx;

DROP TABLE IF EXISTS roomdate_app.listing_images;

ALTER TABLE roomdate_app.listings
    DROP CONSTRAINT IF EXISTS listings_user_id_fkey,
    DROP CONSTRAINT IF EXISTS listings_price_check,
    DROP CONSTRAINT IF EXISTS listings_room_type_check,
    DROP COLUMN IF EXISTS amenities,
    DROP COLUMN IF EXISTS bills_included,
    DROP COLUMN IF EXISTS available_from,
    DROP COLUMN IF EXISTS is_active,
    DROP COLUMN IF EXISTS updated_at,
    ADD CONSTRAINT listings_user_id_fkey FOREIGN KEY (user_id) REFERENCES roomdate_app.users (id) NOT VALID;

ALTER TABLE roomdate_app.conversations
    DROP CONSTRAINT IF EXISTS conversations_listing_id_fkey,
    DROP CONSTRAINT IF EXISTS conversations_tenant_id_fkey,
    DROP CONSTRAINT IF EXISTS conversations_user2_id_fkey,
    ADD CONSTRAINT conversations_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES roomdate_app.listings (id) NOT VALID,
    ADD CONSTRAINT conversations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES roomdate_app.users (id) NOT VALID,
    ADD CONSTRAINT conversations_user2_id_fkey FOREIGN KEY (user2_id) REFERENCES roomdate_app.users (id) NOT VALID;

ALTER TABLE roomdate_app.messages
    DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey,
    DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES roomdate_app.conversations (id) NOT VALID,
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES roomdate_app.users (id) NOT VALID;
