package db

import (
	"crypto/tls"
	"testing"

	"github.com/jackc/pgx/v5"
)

// Verso un database remoto la connessione verifica sempre certificato e nome del server,
// anche se la stringa di connessione chiede meno (sslmode=require è il valore di Neon).
func TestRemoteConnectionsVerifyTLS(t *testing.T) {
	for _, mode := range []string{"require", "prefer", "disable", "verify-ca", "verify-full"} {
		dsn := "postgresql://utente:segreto@ep-floral-violet-aldznrms.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=" + mode
		cfg, err := Config(dsn)
		if err != nil {
			t.Fatal(err)
		}
		tlsConfig := cfg.ConnConfig.TLSConfig
		if tlsConfig == nil || tlsConfig.InsecureSkipVerify || tlsConfig.ServerName != "ep-floral-violet-aldznrms.c-3.eu-central-1.aws.neon.tech" {
			t.Errorf("sslmode=%s: TLS = %+v", mode, tlsConfig)
		}
		if tlsConfig != nil && tlsConfig.MinVersion < tls.VersionTLS12 {
			t.Errorf("sslmode=%s: versione minima di TLS %x", mode, tlsConfig.MinVersion)
		}
		if len(cfg.ConnConfig.Fallbacks) != 0 {
			t.Errorf("sslmode=%s: ripieghi senza verifica %+v", mode, cfg.ConnConfig.Fallbacks)
		}
	}
}

// In locale (socket Unix o loopback) resta quello che dice la stringa di connessione.
func TestLocalConnectionsAreUnchanged(t *testing.T) {
	for _, dsn := range []string{
		"postgres://postgres@/roomdate?host=/var/run/postgresql",
		"postgres://postgres@localhost:5432/roomdate?sslmode=disable",
		"postgres://postgres@127.0.0.1:5432/roomdate?sslmode=disable",
	} {
		cfg, err := Config(dsn)
		if err != nil {
			t.Fatal(err)
		}
		if cfg.ConnConfig.TLSConfig != nil {
			t.Errorf("%s: TLS imposto su una connessione locale", dsn)
		}
	}
	parsed, _ := pgx.ParseConfig("postgres://postgres@localhost/roomdate?sslmode=require")
	requireVerifiedTLS(parsed)
	if parsed.TLSConfig == nil || !parsed.TLSConfig.InsecureSkipVerify {
		t.Error("in locale sslmode=require resta com'è")
	}
}
