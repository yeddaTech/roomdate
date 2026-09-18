-- Crittografia end-to-end reale (modulo M3.4).
--
-- Finora il browser inviava la password al server, che la usava per l'accesso; la stessa password
-- proteggeva anche la chiave privata delle chat. Chi gestisce il server poteva quindi ricavare
-- quella chiave e leggere i messaggi (vulnerabilità S8).
--
-- Da qui in avanti il browser ricava dalla password due chiavi diverse:
-- - una va al server e serve solo all'accesso;
-- - l'altra non esce mai dal browser e apre la chiave privata delle chat.
--
-- kdf_version dice come è stato fatto il calcolo: 1 = vecchio metodo (password al server),
-- 2 = due chiavi separate. Gli account restano al metodo 1 finché non rifanno l'accesso.

-- +goose Up
ALTER TABLE roomdate_app.users
    ADD COLUMN IF NOT EXISTS kdf_version    SMALLINT NOT NULL DEFAULT 1,
    -- Sale e numero di ripetizioni del calcolo, pubblici: servono al browser prima dell'accesso.
    ADD COLUMN IF NOT EXISTS kdf_salt       TEXT,
    ADD COLUMN IF NOT EXISTS kdf_iterations INTEGER;

-- +goose Down
ALTER TABLE roomdate_app.users
    DROP COLUMN IF EXISTS kdf_version,
    DROP COLUMN IF EXISTS kdf_salt,
    DROP COLUMN IF EXISTS kdf_iterations;
