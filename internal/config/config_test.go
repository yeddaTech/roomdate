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

func TestSiteAndPushFromEnv(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/roomdate")
	t.Setenv("APP_SECRET", "segreto")
	t.Setenv("SITE_URL", "")
	t.Setenv("VAPID_PRIVATE_KEY", "")
	t.Setenv("VAPID_SUBJECT", "")
	t.Setenv("PUSH_TEST_ORIGINS", "")

	cfg, err := FromEnv()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.SiteURL != DefaultSiteURL || cfg.Push.PrivateKey != "" || len(cfg.Push.TestOrigins) != 0 {
		t.Errorf("valori predefiniti: %+v", cfg)
	}

	t.Setenv("SITE_URL", "https://www.roomdate.example/")
	t.Setenv("VAPID_PRIVATE_KEY", " chiave ")
	t.Setenv("VAPID_SUBJECT", "mailto:info@roomdate.example")
	t.Setenv("PUSH_TEST_ORIGINS", "http://127.0.0.1:9200, ")
	cfg, err = FromEnv()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.SiteURL != "https://www.roomdate.example" {
		t.Errorf("SiteURL = %q (senza / finale)", cfg.SiteURL)
	}
	if cfg.Push.PrivateKey != "chiave" || cfg.Push.Subject != "mailto:info@roomdate.example" || strings.Join(cfg.Push.TestOrigins, "|") != "http://127.0.0.1:9200" {
		t.Errorf("Push = %+v", cfg.Push)
	}
}
