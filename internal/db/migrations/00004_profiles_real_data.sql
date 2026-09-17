-- Profili su dati reali (modulo M1.5):
-- - email senza maiuscole e indice unico che le ignora (F2);
-- - abitudini (lifestyle_tags) da testo libero a elenco di chiavi fisse (F14);
-- - occupazione e città con i valori degli elenchi in shared/options.json (F15, F17).
--
-- I valori esistenti vengono riconosciuti ignorando maiuscole, accenti, emoji e punteggiatura.
-- Abitudini e occupazioni non riconosciute vengono scartate; le città fuori elenco restano come sono,
-- e il frontend chiede di sceglierne una alla prossima modifica. Entrambi i casi sono elencati con un WARNING.
-- Se due account hanno la stessa email a meno delle maiuscole la migrazione si ferma senza modificare nulla.

-- +goose Up
-- +goose StatementBegin
CREATE FUNCTION pg_temp.roomdate_norm(s TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT trim(regexp_replace(translate(lower(s), 'àáèéìíòóùú''’', 'aaeeiioouu'), '[^a-z]+', ' ', 'g'))
$$;
-- +goose StatementEnd

-- Email: i doppioni non sono ammessi dall'indice unico e vanno risolti a mano
-- +goose StatementBegin
DO $$
DECLARE
    duplicates TEXT;
BEGIN
    SELECT string_agg(email, ', ') INTO duplicates
    FROM (SELECT lower(trim(email)) AS email FROM roomdate_app.users GROUP BY 1 HAVING count(*) > 1) d;
    IF duplicates IS NOT NULL THEN
        RAISE EXCEPTION 'Email usate da più account con maiuscole diverse: %. Risolvi i doppioni e ripeti la migrazione.', duplicates;
    END IF;
END $$;
-- +goose StatementEnd

UPDATE roomdate_app.users SET email = lower(trim(email)) WHERE email <> lower(trim(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON roomdate_app.users (lower(email));

-- Abitudini. Oltre alle etichette salvate dalla registrazione ("Non Fumatore, Ho animali") riconosce
-- i frammenti salvati dalla vecchia dashboard, che teneva solo la seconda parola ("Non", "Ho").
CREATE TEMP TABLE lifestyle_pieces ON COMMIT DROP AS
SELECT u.id, trim(piece.value) AS original, m.key
FROM roomdate_app.users u
CROSS JOIN LATERAL regexp_split_to_table(COALESCE(u.lifestyle_tags, ''), ',') AS piece(value)
LEFT JOIN (VALUES
    ('non fumatore', 'non_fumatore'), ('non', 'non_fumatore'),
    ('fumatore', 'fumatore'),
    ('ho animali', 'animali'), ('ho', 'animali'), ('animali', 'animali'),
    ('ordinato a', 'ordinato'), ('ordinato', 'ordinato'), ('ordinata', 'ordinato'),
    ('socievole', 'socievole'),
    ('vegano vegetariano', 'vegetariano'), ('vegano', 'vegetariano'), ('vegana', 'vegetariano'),
    ('vegetariano', 'vegetariano'), ('vegetariana', 'vegetariano')
) AS m(normalized, key) ON m.normalized = pg_temp.roomdate_norm(piece.value)
WHERE pg_temp.roomdate_norm(piece.value) <> '';

-- +goose StatementBegin
DO $$
DECLARE
    unknown TEXT;
    conflicts INTEGER;
BEGIN
    SELECT string_agg(DISTINCT original, ', ') INTO unknown FROM lifestyle_pieces WHERE key IS NULL;
    IF unknown IS NOT NULL THEN
        RAISE WARNING 'Abitudini non riconosciute, scartate: %', unknown;
    END IF;
    SELECT count(*) INTO conflicts FROM (
        SELECT id FROM lifestyle_pieces GROUP BY id
        HAVING bool_or(key = 'fumatore') AND bool_or(key = 'non_fumatore')
    ) c;
    IF conflicts > 0 THEN
        RAISE WARNING 'Profili con "Fumatore" e "Non fumatore" insieme: % (scartate entrambe le voci)', conflicts;
    END IF;
END $$;
-- +goose StatementEnd

ALTER TABLE roomdate_app.users ADD COLUMN lifestyle_keys TEXT[] NOT NULL DEFAULT '{}';

UPDATE roomdate_app.users u
SET lifestyle_keys = k.keys
FROM (
    SELECT id, array_agg(key ORDER BY array_position(
               ARRAY['non_fumatore', 'fumatore', 'animali', 'ordinato', 'socievole', 'vegetariano'], key)) AS keys
    FROM (SELECT DISTINCT id, key FROM lifestyle_pieces WHERE key IS NOT NULL) p
    GROUP BY id
) k
WHERE u.id = k.id;

UPDATE roomdate_app.users
SET lifestyle_keys = array_remove(array_remove(lifestyle_keys, 'fumatore'), 'non_fumatore')
WHERE lifestyle_keys @> ARRAY['fumatore', 'non_fumatore'];

ALTER TABLE roomdate_app.users DROP COLUMN lifestyle_tags;
ALTER TABLE roomdate_app.users RENAME COLUMN lifestyle_keys TO lifestyle_tags;

-- Occupazione: la registrazione salvava "Studente", la dashboard "studente" e "misto" (F15)
CREATE TEMP TABLE occupation_map (normalized, key) ON COMMIT DROP AS VALUES
    ('studente', 'studente'), ('studentessa', 'studente'),
    ('lavoratore', 'lavoratore'), ('lavoratrice', 'lavoratore'),
    ('studente e lavoratore', 'studente_lavoratore'), ('studente lavoratore', 'studente_lavoratore'),
    ('studentessa e lavoratrice', 'studente_lavoratore'), ('misto', 'studente_lavoratore');

-- +goose StatementBegin
DO $$
DECLARE
    unknown TEXT;
BEGIN
    SELECT string_agg(DISTINCT occupation, ', ') INTO unknown FROM roomdate_app.users
    WHERE pg_temp.roomdate_norm(COALESCE(occupation, '')) <> ''
      AND pg_temp.roomdate_norm(occupation) NOT IN (SELECT normalized FROM occupation_map);
    IF unknown IS NOT NULL THEN
        RAISE WARNING 'Occupazioni non riconosciute, scartate: %', unknown;
    END IF;
END $$;
-- +goose StatementEnd

UPDATE roomdate_app.users
SET occupation = (SELECT key FROM occupation_map WHERE normalized = pg_temp.roomdate_norm(occupation))
WHERE occupation IS NOT NULL;

-- Città: stesso nome dell'elenco, a meno di maiuscole, spazi e accenti ("milano ", "Forli")
CREATE TEMP TABLE city_names (name) ON COMMIT DROP AS VALUES
    ('Agrigento'), ('Alessandria'), ('Ancona'), ('Andria'), ('Aosta'), ('Arezzo'), ('Ascoli Piceno'),
    ('Asti'), ('Avellino'), ('Bari'), ('Barletta'), ('Belluno'), ('Benevento'), ('Bergamo'), ('Biella'),
    ('Bologna'), ('Bolzano'), ('Brescia'), ('Brindisi'), ('Cagliari'), ('Caltanissetta'), ('Campobasso'),
    ('Carbonia'), ('Caserta'), ('Catania'), ('Catanzaro'), ('Cesena'), ('Chieti'), ('Como'), ('Cosenza'),
    ('Cremona'), ('Crotone'), ('Cuneo'), ('Enna'), ('Fermo'), ('Ferrara'), ('Firenze'), ('Foggia'), ('Forlì'),
    ('Frosinone'), ('Genova'), ('Gorizia'), ('Grosseto'), ('Imperia'), ('Isernia'), ('L''Aquila'),
    ('La Spezia'), ('Latina'), ('Lecce'), ('Lecco'), ('Livorno'), ('Lodi'), ('Lucca'), ('Macerata'),
    ('Mantova'), ('Massa'), ('Matera'), ('Messina'), ('Milano'), ('Modena'), ('Monza'), ('Napoli'),
    ('Novara'), ('Nuoro'), ('Olbia'), ('Oristano'), ('Padova'), ('Palermo'), ('Parma'), ('Pavia'),
    ('Perugia'), ('Pesaro'), ('Pescara'), ('Piacenza'), ('Pisa'), ('Pistoia'), ('Pordenone'), ('Potenza'),
    ('Prato'), ('Ragusa'), ('Ravenna'), ('Reggio Calabria'), ('Reggio Emilia'), ('Rieti'), ('Rimini'),
    ('Roma'), ('Rovigo'), ('Salerno'), ('Sassari'), ('Savona'), ('Siena'), ('Siracusa'), ('Sondrio'),
    ('Taranto'), ('Teramo'), ('Terni'), ('Torino'), ('Trani'), ('Trapani'), ('Trento'), ('Treviso'),
    ('Trieste'), ('Udine'), ('Urbino'), ('Varese'), ('Venezia'), ('Verbania'), ('Vercelli'), ('Verona'),
    ('Vibo Valentia'), ('Vicenza'), ('Viterbo');

UPDATE roomdate_app.users SET citta = NULL WHERE trim(citta) = '';

UPDATE roomdate_app.users u
SET citta = c.name
FROM city_names c
WHERE pg_temp.roomdate_norm(u.citta) = pg_temp.roomdate_norm(c.name) AND u.citta <> c.name;

UPDATE roomdate_app.listings l
SET city = c.name
FROM city_names c
WHERE pg_temp.roomdate_norm(l.city) = pg_temp.roomdate_norm(c.name) AND l.city <> c.name;

-- +goose StatementBegin
DO $$
DECLARE
    unknown TEXT;
BEGIN
    SELECT string_agg(DISTINCT citta, ', ') INTO unknown FROM roomdate_app.users
    WHERE citta IS NOT NULL AND citta NOT IN (SELECT name FROM city_names);
    IF unknown IS NOT NULL THEN
        RAISE WARNING 'Città dei profili fuori elenco, lasciate invariate: %', unknown;
    END IF;
    SELECT string_agg(DISTINCT city, ', ') INTO unknown FROM roomdate_app.listings
    WHERE city NOT IN (SELECT name FROM city_names);
    IF unknown IS NOT NULL THEN
        RAISE WARNING 'Città degli annunci fuori elenco, lasciate invariate: %', unknown;
    END IF;
END $$;
-- +goose StatementEnd

DROP FUNCTION pg_temp.roomdate_norm(TEXT);

-- +goose Down
-- Email, occupazioni e città restano normalizzate. Le abitudini tornano testo, con le chiavi al posto delle etichette.
DROP INDEX IF EXISTS roomdate_app.users_email_lower_key;
ALTER TABLE roomdate_app.users ALTER COLUMN lifestyle_tags DROP DEFAULT;
ALTER TABLE roomdate_app.users ALTER COLUMN lifestyle_tags DROP NOT NULL;
ALTER TABLE roomdate_app.users ALTER COLUMN lifestyle_tags TYPE TEXT USING array_to_string(lifestyle_tags, ', ');
