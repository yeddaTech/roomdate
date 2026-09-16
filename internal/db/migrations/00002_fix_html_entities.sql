-- Ripara i testi salvati con entità HTML (anomalia F1 del piano di refactoring).
--
-- bluemonday salvava il testo già "escapato": "un'amica" diventava "un&#39;amica", e ogni nuovo
-- salvataggio dalla Dashboard aggiungeva un livello ("un&amp;#39;amica"). Qui il testo viene
-- decodificato più volte, finché non cambia più (al massimo 10 livelli).
-- Il backend ora salva il testo senza entità (backend/text.go), quindi il problema non si ripresenta.
-- React fa l'escape in output: riportare "<" o "&" nel testo non introduce rischi di XSS.

-- +goose Up
-- +goose StatementBegin
CREATE FUNCTION pg_temp.roomdate_html_unescape(input TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
    result   TEXT := input;
    previous TEXT;
BEGIN
    IF result IS NULL THEN
        RETURN NULL;
    END IF;

    FOR i IN 1..10 LOOP
        previous := result;
        -- "&amp;" per ultimo, così "&amp;lt;" diventa "&lt;" e non "<" nello stesso passaggio
        result := replace(replace(replace(replace(replace(result,
            '&#39;', ''''),
            '&#34;', '"'),
            '&lt;', '<'),
            '&gt;', '>'),
            '&amp;', '&');
        EXIT WHEN result = previous;
    END LOOP;

    RETURN result;
END;
$$;
-- +goose StatementEnd

UPDATE roomdate_app.users
SET first_name     = pg_temp.roomdate_html_unescape(first_name),
    last_name      = pg_temp.roomdate_html_unescape(last_name),
    citta          = pg_temp.roomdate_html_unescape(citta),
    occupation     = pg_temp.roomdate_html_unescape(occupation),
    bio            = pg_temp.roomdate_html_unescape(bio),
    lifestyle_tags = pg_temp.roomdate_html_unescape(lifestyle_tags)
WHERE concat_ws(' ', first_name, last_name, citta, occupation, bio, lifestyle_tags) ~ '&(amp|lt|gt|#34|#39);';

UPDATE roomdate_app.listings
SET title       = pg_temp.roomdate_html_unescape(title),
    city        = pg_temp.roomdate_html_unescape(city),
    zone        = pg_temp.roomdate_html_unescape(zone),
    description = pg_temp.roomdate_html_unescape(description)
WHERE concat_ws(' ', title, city, zone, description) ~ '&(amp|lt|gt|#34|#39);';

DROP FUNCTION pg_temp.roomdate_html_unescape(TEXT);

-- +goose Down
-- Irreversibile: non ha senso ripristinare il testo corrotto.
SELECT 1;
