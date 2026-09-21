-- Protezione del database (modulo M3.6): vincoli che il database fa rispettare anche se il codice
-- sbaglia, sugli stessi limiti che l'applicazione controlla già.
--
-- Ogni vincolo viene aggiunto solo se tutte le righe esistenti lo rispettano: un vincolo violato
-- impedirebbe qualsiasi modifica a quelle righe (anche l'aggiornamento della password all'accesso).
-- Se qualche riga non lo rispetta, il vincolo non viene aggiunto e la migrazione lo segnala.
--
-- Unica correzione dei dati: un budget fuori dall'intervallo ammesso (0-20.000 €) diventa
-- "non indicato". Il valore non era comunque salvabile dall'app e non corrisponde a nessun affitto reale.

-- +goose Up
-- +goose StatementBegin
DO $$
DECLARE
    fixed INTEGER;
BEGIN
    UPDATE roomdate_app.users SET budget_max = NULL WHERE budget_max < 0 OR budget_max > 20000;
    GET DIAGNOSTICS fixed = ROW_COUNT;
    IF fixed > 0 THEN
        RAISE WARNING 'Budget fuori intervallo diventati "non indicato": % profili', fixed;
    END IF;
END $$;
-- +goose StatementEnd

-- Profilo pubblico se non indicato: è già il comportamento dell'app, ora lo garantisce il database
UPDATE roomdate_app.users SET is_public = TRUE WHERE is_public IS NULL;
ALTER TABLE roomdate_app.users ALTER COLUMN is_public SET DEFAULT TRUE;
ALTER TABLE roomdate_app.users ALTER COLUMN is_public SET NOT NULL;

-- +goose StatementBegin
DO $$
DECLARE
    c RECORD;
    violations BIGINT;
BEGIN
    FOR c IN SELECT * FROM (VALUES
        ('roomdate_app.users', 'users_email_lowercase_check', $c$email = lower(btrim(email))$c$),
        ('roomdate_app.users', 'users_user_type_check', $c$user_type IN ('cerca', 'affitta')$c$),
        ('roomdate_app.users', 'users_budget_max_check', $c$budget_max BETWEEN 0 AND 20000$c$),
        ('roomdate_app.users', 'users_bio_length_check', $c$char_length(bio) <= 1000$c$),
        -- Metodo nuovo delle chiavi: servono sale e almeno 600.000 ripetizioni (modulo M3.4)
        ('roomdate_app.users', 'users_kdf_check',
            $c$kdf_version IN (1, 2) AND (kdf_version = 1 OR (kdf_salt IS NOT NULL AND kdf_iterations >= 600000))$c$),
        -- Chiave di recupero: sale e hash ci sono insieme o mancano insieme
        ('roomdate_app.users', 'users_recovery_check', $c$(recovery_hash IS NULL) = (recovery_salt IS NULL)$c$),
        ('roomdate_app.listings', 'listings_title_not_blank_check', $c$btrim(title) <> ''$c$),
        ('roomdate_app.listings', 'listings_zone_length_check', $c$char_length(zone) <= 80$c$),
        ('roomdate_app.listings', 'listings_description_length_check', $c$char_length(description) <= 5000$c$),
        -- Formato 2 (cifratura ibrida): il testo cifrato e il suo IV non possono mancare
        ('roomdate_app.messages', 'messages_format_check',
            $c$format IN (1, 2) AND (format = 1 OR (body IS NOT NULL AND iv IS NOT NULL))$c$),
        ('roomdate_app.messages', 'messages_body_length_check', $c$char_length(body) <= 24000$c$),
        ('roomdate_app.sessions', 'sessions_expiry_check', $c$expires_at > created_at$c$)
    ) AS t(tbl, name, expr)
    LOOP
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.name) THEN
            CONTINUE;
        END IF;
        EXECUTE format('SELECT count(*) FROM %s WHERE NOT (%s)', c.tbl, c.expr) INTO violations;
        IF violations > 0 THEN
            RAISE WARNING 'Vincolo % non aggiunto: % righe di % non lo rispettano', c.name, violations, c.tbl;
        ELSE
            EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I CHECK (%s)', c.tbl, c.name, c.expr);
        END IF;
    END LOOP;
END $$;
-- +goose StatementEnd

-- Date dei messaggi e delle conversazioni: le scrive sempre il database, non possono mancare.
-- Anche qui solo se le righe esistenti le hanno tutte.
-- +goose StatementBegin
DO $$
DECLARE
    c RECORD;
    missing BIGINT;
BEGIN
    FOR c IN SELECT * FROM (VALUES
        ('roomdate_app.messages', 'created_at'),
        ('roomdate_app.conversations', 'created_at')
    ) AS t(tbl, col)
    LOOP
        EXECUTE format('SELECT count(*) FROM %s WHERE %I IS NULL', c.tbl, c.col) INTO missing;
        IF missing > 0 THEN
            RAISE WARNING 'Colonna %.% lasciata facoltativa: % righe senza valore', c.tbl, c.col, missing;
        ELSE
            EXECUTE format('ALTER TABLE %s ALTER COLUMN %I SET NOT NULL', c.tbl, c.col);
        END IF;
    END LOOP;
END $$;
-- +goose StatementEnd

-- +goose Down
ALTER TABLE roomdate_app.users
    DROP CONSTRAINT IF EXISTS users_email_lowercase_check,
    DROP CONSTRAINT IF EXISTS users_user_type_check,
    DROP CONSTRAINT IF EXISTS users_budget_max_check,
    DROP CONSTRAINT IF EXISTS users_bio_length_check,
    DROP CONSTRAINT IF EXISTS users_kdf_check,
    DROP CONSTRAINT IF EXISTS users_recovery_check,
    ALTER COLUMN is_public DROP NOT NULL;
ALTER TABLE roomdate_app.listings
    DROP CONSTRAINT IF EXISTS listings_title_not_blank_check,
    DROP CONSTRAINT IF EXISTS listings_zone_length_check,
    DROP CONSTRAINT IF EXISTS listings_description_length_check;
ALTER TABLE roomdate_app.messages
    DROP CONSTRAINT IF EXISTS messages_format_check,
    DROP CONSTRAINT IF EXISTS messages_body_length_check,
    ALTER COLUMN created_at DROP NOT NULL;
ALTER TABLE roomdate_app.sessions DROP CONSTRAINT IF EXISTS sessions_expiry_check;
ALTER TABLE roomdate_app.conversations ALTER COLUMN created_at DROP NOT NULL;
