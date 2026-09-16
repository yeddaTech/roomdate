// Server di sviluppo locale: espone le stesse API della funzione Vercel (api/index.go)
// su http://127.0.0.1:8080. Vite (npm run dev) inoltra qui le richieste /api, così frontend
// e API condividono l'origine come in produzione.
//
//	go run ./cmd/dev
//
// Legge le variabili da .env.local (vedi .env.example).
package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	handler "roomdate-backend/api"
	"roomdate-backend/backend"
	"roomdate-backend/internal/devenv"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "indirizzo di ascolto")
	envFile := flag.String("env", ".env.local", "file con le variabili d'ambiente")
	flag.Parse()

	loaded, err := devenv.Load(*envFile)
	if err != nil {
		log.Fatalf("Errore nel file %s: %v", *envFile, err)
	}
	if loaded {
		log.Printf("Variabili caricate da %s", *envFile)
	}

	for _, key := range []string{"DATABASE_URL", "JWT_SECRET"} {
		if os.Getenv(key) == "" {
			log.Fatalf("%s non impostata: copia .env.example in .env.local e compilala", key)
		}
	}
	if os.Getenv("PUSHER_KEY") == "" {
		log.Print("PUSHER_* non impostate: la chat funziona, ma senza tempo reale (il frontend aggiorna ogni 5 secondi)")
	}

	host, dbname := devenv.DescribeDSN(os.Getenv("DATABASE_URL"))
	log.Printf("Database: %s / %s", host, dbname)

	// La connessione di init() è saltata se DATABASE_URL arrivava da .env.local
	backend.InitDB()
	if err := backend.DB.Ping(); err != nil {
		log.Fatalf("Database non raggiungibile: %v", err)
	}

	// In locale si usa HTTP: con il flag Secure alcuni browser scarterebbero il cookie di sessione
	backend.SecureCookies = false

	mux := http.NewServeMux()
	mux.HandleFunc("/api/", handler.Handler)

	server := &http.Server{
		Addr:              *addr,
		Handler:           logRequests(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("API di sviluppo su http://%s — avvia il frontend con: npm run dev", *addr)
	log.Fatal(server.ListenAndServe())
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf("%s %s → %d (%s)", r.Method, r.URL.Path, rec.status, time.Since(start).Round(time.Millisecond))
	})
}
