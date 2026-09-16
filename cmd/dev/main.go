// Server di sviluppo locale: espone la stessa applicazione della funzione Vercel (api/index.go)
// su http://127.0.0.1:8080. Vite (npm run dev) inoltra qui le richieste /api, così frontend
// e API condividono l'origine come in produzione.
//
//	go run ./cmd/dev
//
// Legge le variabili da .env.local (vedi .env.example).
package main

import (
	"context"
	"flag"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"roomdate-backend/internal/config"
	"roomdate-backend/internal/db"
	"roomdate-backend/internal/devenv"
	"roomdate-backend/internal/realtime"
	"roomdate-backend/server"
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

	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatalf("%v: copia .env.example in .env.local e compilala", err)
	}
	// In locale si usa HTTP: con il flag Secure alcuni browser scarterebbero il cookie di sessione
	cfg.SecureCookies = false

	if !cfg.Pusher.Enabled() {
		log.Print("PUSHER_* non impostate: la chat funziona, ma senza tempo reale (il frontend aggiorna ogni 5 secondi)")
	}
	if !cfg.Storage.Enabled() {
		log.Print("R2_* non impostate: annunci senza caricamento foto")
	}

	host, dbname := devenv.DescribeDSN(cfg.DatabaseURL)
	log.Printf("Database: %s / %s", host, dbname)

	ctx := context.Background()
	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Stringa di connessione non valida: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Database non raggiungibile: %v", err)
	}

	handler, err := server.New(server.Deps{
		Config:    cfg,
		DB:        pool,
		Publisher: realtime.New(cfg.Pusher),
		Logger:    slog.New(slog.NewTextHandler(os.Stderr, nil)),
	})
	if err != nil {
		log.Fatal(err)
	}

	srv := &http.Server{
		Addr:              *addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("API di sviluppo su http://%s — avvia il frontend con: npm run dev", *addr)
	log.Fatal(srv.ListenAndServe())
}
