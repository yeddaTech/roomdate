package config

import (
	"strings"
	"testing"
)

func TestFromEnvRequiresSecrets(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("JWT_SECRET", "")
	t.Setenv("APP_SECRET", "")

	_, err := FromEnv()
	if err == nil || !strings.Contains(err.Error(), "DATABASE_URL") || !strings.Contains(err.Error(), "APP_SECRET") {
		t.Fatalf("errore = %v", err)
	}
}

func TestFromEnv(t *testing.T) {
	t.Setenv("DATABASE_URL", " postgres://localhost/roomdate ")
	t.Setenv("JWT_SECRET", "segreto")
	t.Setenv("TRUSTED_ORIGINS", "https://www.roomdate.it, ,https://roomdate.it")
	t.Setenv("PUSHER_APP_ID", "1")
	t.Setenv("PUSHER_KEY", "k")
	t.Setenv("PUSHER_SECRET", "")

	cfg, err := FromEnv()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DatabaseURL != "postgres://localhost/roomdate" || !cfg.SecureCookies {
		t.Errorf("config = %+v", cfg)
	}
	if strings.Join(cfg.TrustedOrigins, "|") != "https://www.roomdate.it|https://roomdate.it" {
		t.Errorf("TrustedOrigins = %v", cfg.TrustedOrigins)
	}
	if cfg.Pusher.Enabled() {
		t.Error("Pusher senza secret non deve risultare attivo")
	}
}
