// Package devenv carica le variabili d'ambiente da un file .env per gli strumenti di sviluppo
// (server locale, migrazioni, seed). Non viene mai usato dalla funzione serverless su Vercel.
package devenv

import (
	"bufio"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"strings"
)

// Load legge il file indicato (formato KEY=VALUE) e imposta le variabili che non sono già
// definite nell'ambiente. Restituisce false se il file non esiste.
func Load(path string) (bool, error) {
	f, err := os.Open(path)
	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	lineNo := 0
	for scanner.Scan() {
		lineNo++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return true, fmt.Errorf("%s:%d: riga senza '='", path, lineNo)
		}
		key = strings.TrimSpace(key)
		value = unquote(strings.TrimSpace(value))

		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, value)
		}
	}
	return true, scanner.Err()
}

// DescribeDSN restituisce host e nome del database di una stringa di connessione Postgres,
// senza credenziali, da mostrare prima di operazioni che modificano i dati.
func DescribeDSN(dsn string) (host, dbname string) {
	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		if u, err := url.Parse(dsn); err == nil {
			return u.Host, strings.TrimPrefix(u.Path, "/")
		}
		return "?", "?"
	}
	// Formato "chiave=valore" (es. host=localhost dbname=roomdate)
	for _, field := range strings.Fields(dsn) {
		if k, v, ok := strings.Cut(field, "="); ok {
			switch k {
			case "host":
				host = v
			case "dbname":
				dbname = v
			}
		}
	}
	return host, dbname
}

// IsLocalHost indica se l'host è la macchina locale (loopback o socket Unix).
func IsLocalHost(host string) bool {
	h := host
	if strings.HasPrefix(h, "[") { // IPv6 con porta, es. [::1]:5432
		h = strings.TrimPrefix(strings.SplitN(h, "]", 2)[0], "[")
	} else if i := strings.LastIndex(h, ":"); i >= 0 && strings.Count(h, ":") == 1 {
		h = h[:i]
	}
	return h == "" || h == "localhost" || h == "127.0.0.1" || h == "::1" || strings.HasPrefix(h, "/")
}

func unquote(v string) string {
	if len(v) >= 2 && (v[0] == '"' || v[0] == '\'') && v[len(v)-1] == v[0] {
		return v[1 : len(v)-1]
	}
	return v
}
