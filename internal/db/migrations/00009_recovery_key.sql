-- Chiave di recupero (modulo M3.4, decisione D3).
--
-- Alla registrazione il browser genera un codice casuale che l'utente conserva. Dal codice ricava,
-- come dalla password, due chiavi: una va al server, che ne salva solo l'hash, e permette di
-- dimostrare di avere il codice; l'altra cifra una seconda copia della chiave privata delle chat.
-- Chi dimentica la password può così impostarne una nuova senza perdere i messaggi, anche senza
-- un servizio email. Il server non riceve mai il codice e non può aprire la copia della chiave.

-- +goose Up
ALTER TABLE roomdate_app.users
    ADD COLUMN IF NOT EXISTS recovery_salt                  TEXT,
    ADD COLUMN IF NOT EXISTS recovery_hash                  TEXT,
    ADD COLUMN IF NOT EXISTS recovery_encrypted_private_key TEXT,
    ADD COLUMN IF NOT EXISTS recovery_iv                    TEXT,
    ADD COLUMN IF NOT EXISTS recovery_created_at            TIMESTAMPTZ;

-- I tentativi falliti con la chiave di recupero rallentano chi prova a indovinarla, come per l'accesso
CREATE INDEX IF NOT EXISTS security_events_recovery_email_idx
    ON roomdate_app.security_events (email_hash, created_at DESC) WHERE kind = 'recovery_failed';
CREATE INDEX IF NOT EXISTS security_events_recovery_ip_idx
    ON roomdate_app.security_events (ip_hash, created_at DESC) WHERE kind = 'recovery_failed';

-- +goose Down
DROP INDEX IF EXISTS roomdate_app.security_events_recovery_email_idx;
DROP INDEX IF EXISTS roomdate_app.security_events_recovery_ip_idx;
ALTER TABLE roomdate_app.users
    DROP COLUMN IF EXISTS recovery_salt,
    DROP COLUMN IF EXISTS recovery_hash,
    DROP COLUMN IF EXISTS recovery_encrypted_private_key,
    DROP COLUMN IF EXISTS recovery_iv,
    DROP COLUMN IF EXISTS recovery_created_at;
