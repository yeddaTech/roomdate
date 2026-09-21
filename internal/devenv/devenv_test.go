package devenv

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoad(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env.local")
	content := `# commento
DEVENV_PLAIN=valore
export DEVENV_EXPORTED=esportato
DEVENV_QUOTED="con spazi e = uguale"
DEVENV_SINGLE='singoli'
DEVENV_URL=postgresql://u:p@host/db?sslmode=require

DEVENV_EXISTING=dal-file
`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("DEVENV_EXISTING", "dall-ambiente")
	for _, key := range []string{"DEVENV_PLAIN", "DEVENV_EXPORTED", "DEVENV_QUOTED", "DEVENV_SINGLE", "DEVENV_URL"} {
		t.Setenv(key, "")
		os.Unsetenv(key)
	}

	loaded, err := Load(path)
	if err != nil || !loaded {
		t.Fatalf("loaded = %v, err = %v", loaded, err)
	}
	for key, want := range map[string]string{
		"DEVENV_PLAIN":    "valore",
		"DEVENV_EXPORTED": "esportato",
		"DEVENV_QUOTED":   "con spazi e = uguale",
		"DEVENV_SINGLE":   "singoli",
		"DEVENV_URL":      "postgresql://u:p@host/db?sslmode=require",
		"DEVENV_EXISTING": "dall-ambiente",
	} {
		if got := os.Getenv(key); got != want {
			t.Errorf("%s = %q, atteso %q", key, got, want)
		}
	}
}

func TestLoadMissingFile(t *testing.T) {
	loaded, err := Load(filepath.Join(t.TempDir(), "assente"))
	if loaded || err != nil {
		t.Fatalf("loaded = %v, err = %v", loaded, err)
	}
}

func TestDescribeDSNHidesCredentials(t *testing.T) {
	cases := []struct{ dsn, host, db string }{
		{"postgresql://utente:segreto@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require", "ep-x.eu-central-1.aws.neon.tech", "neondb"},
		{"host=/tmp/sock port=5432 user=u password=segreto dbname=roomdate", "/tmp/sock", "roomdate"},
	}
	for _, c := range cases {
		host, db := DescribeDSN(c.dsn)
		if host != c.host || db != c.db {
			t.Errorf("DescribeDSN(%q) = %q, %q", c.dsn, host, db)
		}
	}
}

func TestIsLocalHost(t *testing.T) {
	for host, want := range map[string]bool{
		"localhost:5432": true, "127.0.0.1": true, "[::1]:5432": true, "/var/run/postgresql": true, "": true,
		"ep-x.neon.tech": false, "db.example.com:5432": false,
	} {
		if got := IsLocalHost(host); got != want {
			t.Errorf("IsLocalHost(%q) = %v, atteso %v", host, got, want)
		}
	}
}

func TestDirectNeonDSN(t *testing.T) {
	pooled := "postgresql://neondb_owner:p%40ss@ep-floral-violet-aldznrms-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
	direct, changed := DirectNeonDSN(pooled)
	if !changed || direct != "postgresql://neondb_owner:p%40ss@ep-floral-violet-aldznrms.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require" {
		t.Errorf("DirectNeonDSN = %q, %v", direct, changed)
	}
	for _, dsn := range []string{direct, "host=ep-x-pooler.neon.tech dbname=neondb", "read -rs DATABASE_URL"} {
		if got, changed := DirectNeonDSN(dsn); changed || got != dsn {
			t.Errorf("DirectNeonDSN(%q) = %q, %v: non doveva cambiare", dsn, got, changed)
		}
	}
}

func TestAppNeonDSN(t *testing.T) {
	const want = "postgresql://roomdate_app:Ab-_9@ep-floral-violet-aldznrms-pooler.c-3.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
	for _, owner := range []string{
		"postgresql://neondb_owner:segreto@ep-floral-violet-aldznrms.c-3.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
		"postgresql://neondb_owner:segreto@ep-floral-violet-aldznrms-pooler.c-3.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
	} {
		if got, ok := AppNeonDSN(owner, "roomdate_app", "Ab-_9"); !ok || got != want {
			t.Errorf("AppNeonDSN(%q) = %q, %v", owner, got, ok)
		}
	}
	// Fuori da Neon il pooler non c'è: cambiano solo ruolo e password
	if got, _ := AppNeonDSN("postgres://owner:x@db.example.com:5432/app", "app", "y"); got != "postgres://app:y@db.example.com:5432/app" {
		t.Errorf("AppNeonDSN fuori da Neon = %q", got)
	}
	if _, ok := AppNeonDSN("host=ep-x.neon.tech dbname=neondb", "app", "y"); ok {
		t.Error("una stringa chiave=valore non si converte")
	}
}
