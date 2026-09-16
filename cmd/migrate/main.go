// Applica le migrazioni SQL del database (internal/db/migrations).
//
//	go run ./cmd/migrate status     stato delle migrazioni
//	go run ./cmd/migrate up         applica quelle mancanti
//	go run ./cmd/migrate up-by-one  applica solo la prossima
//	go run ./cmd/migrate down       annulla l'ultima
//
// Legge DATABASE_URL dall'ambiente o da .env.local. Con Neon usa la connessione diretta
// (host senza "-pooler"). Su un database non locale chiede conferma prima di modificarlo.
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"roomdate-backend/internal/db"
	"roomdate-backend/internal/devenv"
)

var writeCommands = map[string]bool{"up": true, "up-by-one": true, "down": true}
var readCommands = map[string]bool{"status": true, "version": true, "validate": true}

func main() {
	log.SetFlags(0)
	yes := flag.Bool("yes", false, "non chiedere conferma sui database non locali")
	envFile := flag.String("env", ".env.local", "file con le variabili d'ambiente")
	flag.Usage = func() {
		fmt.Fprintln(os.Stderr, "Uso: go run ./cmd/migrate [-yes] [-env file] status|version|validate|up|up-by-one|down")
		flag.PrintDefaults()
	}
	flag.Parse()

	command := flag.Arg(0)
	if command == "" {
		command = "status"
	}
	if !writeCommands[command] && !readCommands[command] {
		flag.Usage()
		os.Exit(2)
	}

	if _, err := devenv.Load(*envFile); err != nil {
		log.Fatalf("Errore nel file %s: %v", *envFile, err)
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL non impostata: copia .env.example in .env.local e compilala")
	}

	host, dbname := devenv.DescribeDSN(dsn)
	log.Printf("Database: %s / %s", host, dbname)

	if writeCommands[command] && !devenv.IsLocalHost(host) && !*yes && !confirm(fmt.Sprintf("Eseguire \"%s\" su questo database NON locale?", command)) {
		log.Fatal("Operazione annullata")
	}

	conn, err := db.OpenSQL(dsn)
	if err != nil {
		log.Fatalf("Connessione non valida: %v", err)
	}
	defer conn.Close()
	if err := conn.Ping(); err != nil {
		log.Fatalf("Database non raggiungibile: %v", err)
	}

	if err := db.Migrate(context.Background(), conn, command); err != nil {
		log.Fatalf("Migrazione fallita: %v", err)
	}
}

func confirm(question string) bool {
	fmt.Printf("%s [s/N] ", question)
	answer, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	answer = strings.ToLower(strings.TrimSpace(answer))
	return answer == "s" || answer == "si" || answer == "sì"
}
