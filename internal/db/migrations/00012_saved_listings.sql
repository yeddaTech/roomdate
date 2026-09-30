-- Preferiti (modulo M2.4): gli annunci salvati da ogni utente. Solo una tabella nuova: il codice
-- precedente continua a funzionare, quindi prima la migrazione e poi il deploy.

-- +goose Up
CREATE TABLE IF NOT EXISTS roomdate_app.saved_listings (
    -- Eliminando l'account o l'annuncio i preferiti che li riguardano spariscono con loro
    user_id    UUID NOT NULL REFERENCES roomdate_app.users (id) ON DELETE CASCADE,
    listing_id INTEGER NOT NULL REFERENCES roomdate_app.listings (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, listing_id)
);
-- Elenco dei preferiti di un utente, dal più recente (con l'annuncio come secondo criterio)
CREATE INDEX IF NOT EXISTS saved_listings_user_created_idx
    ON roomdate_app.saved_listings (user_id, created_at DESC, listing_id DESC);
-- Eliminando un annuncio si cercano i preferiti che lo contengono
CREATE INDEX IF NOT EXISTS saved_listings_listing_idx ON roomdate_app.saved_listings (listing_id);

-- +goose Down
DROP TABLE IF EXISTS roomdate_app.saved_listings;
