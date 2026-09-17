-- Ricerca lato server (modulo M1.6): indici per i filtri e gli ordinamenti degli elenchi pubblici.
-- L'ordine degli indici segue quello delle query, così il database non deve ordinare i risultati:
-- annunci e profili senza data di creazione vanno in fondo (NULLS LAST) e l'ID separa quelli a pari valore.

-- +goose Up
DROP INDEX IF EXISTS roomdate_app.listings_active_created_at_idx;

CREATE INDEX IF NOT EXISTS listings_active_recent_idx
    ON roomdate_app.listings (created_at DESC NULLS LAST, id DESC) WHERE is_active;
CREATE INDEX IF NOT EXISTS listings_active_city_recent_idx
    ON roomdate_app.listings (city, created_at DESC NULLS LAST, id DESC) WHERE is_active;
CREATE INDEX IF NOT EXISTS listings_active_price_idx
    ON roomdate_app.listings (price, id) WHERE is_active;

CREATE INDEX IF NOT EXISTS users_roommates_recent_idx
    ON roomdate_app.users (created_at DESC NULLS LAST, id DESC)
    WHERE COALESCE(is_public, true) AND user_type = 'cerca';
CREATE INDEX IF NOT EXISTS users_roommates_city_idx
    ON roomdate_app.users (citta, created_at DESC NULLS LAST, id DESC)
    WHERE COALESCE(is_public, true) AND user_type = 'cerca';

-- +goose Down
DROP INDEX IF EXISTS roomdate_app.listings_active_recent_idx;
DROP INDEX IF EXISTS roomdate_app.listings_active_city_recent_idx;
DROP INDEX IF EXISTS roomdate_app.listings_active_price_idx;
DROP INDEX IF EXISTS roomdate_app.users_roommates_recent_idx;
DROP INDEX IF EXISTS roomdate_app.users_roommates_city_idx;

CREATE INDEX IF NOT EXISTS listings_active_created_at_idx
    ON roomdate_app.listings (created_at DESC) WHERE is_active;
