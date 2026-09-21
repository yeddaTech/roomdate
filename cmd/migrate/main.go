// Applica le migrazioni SQL del database (internal/db/migrations).
//
//	go run ./cmd/migrate status     stato delle migrazioni
//	go run ./cmd/migrate up         applica quelle mancanti
//	go run ./cmd/migrate up-by-one  applica solo la prossima
//	go run ./cmd/migrate down       annulla l'ultima
//
// Legge DATABASE_URL dall'ambiente o da .env.local. Con Neon usa sempre la connessione diretta
// (toglie "-pooler" dall'host). Su un database non locale chiede conferma prima di modificarlo.
//
// Per la produzione indicare anche l'host atteso: se DATABASE_URL punta altrove non parte nulla.
//
//	go run ./cmd/migrate -host ep-floral-violet-aldznrms up
//
// Le migrazioni si eseguono con il ruolo proprietario dello schema (neondb_owner), non con quello
// dell'applicazione, che può solo leggere e scrivere i dati. grant-app crea quel ruolo (se manca)
// e gli assegna i permessi; alla creazione stampa la stringa di connessione da mettere su Vercel:
//
//	go run ./cmd/migrate -host ep-floral-violet-aldznrms grant-app roomdate_app
package main

import (
	"bufio"
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"roomdate-backend/internal/db"
	"roomdate-backend/internal/devenv"
)

var writeCommands = map[string]bool{"up": true, "up-by-one": true, "down": true, "grant-app": true}
var readCommands = map[string]bool{"status": true, "version": true, "validate": true}

func main() {
	log.SetFlags(0)
	yes := flag.Bool("yes", false, "non chiedere conferma sui database non locali")
	envFile := flag.String("env", ".env.local", "file con le variabili d'ambiente")
	expectedHost := flag.String("host", "", "host atteso del database, anche solo l'inizio (es. ep-floral-violet-aldznrms)")
	flag.Usage = func() {
		fmt.Fprintln(os.Stderr, "Uso: go run ./cmd/migrate [-yes] [-env file] [-host host] status|version|validate|up|up-by-one|down")
		fmt.Fprintln(os.Stderr, "     go run ./cmd/migrate [-yes] [-env file] [-host host] grant-app RUOLO")
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
	if command == "grant-app" && flag.Arg(1) == "" {
		log.Fatal("Indica il ruolo dell'applicazione, es.: go run ./cmd/migrate grant-app roomdate_app")
	}

	if _, err := devenv.Load(*envFile); err != nil {
		log.Fatalf("Errore nel file %s: %v", *envFile, err)
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL non impostata: copia .env.example in .env.local e compilala")
	}

	ownerDSN := dsn
	dsn, direct := devenv.DirectNeonDSN(dsn)
	host, dbname := devenv.DescribeDSN(dsn)
	log.Printf("Database: %s / %s", host, dbname)
	if direct {
		log.Print("Uso la connessione diretta: tolto \"-pooler\" dall'host")
	}
	if *expectedHost != "" && !strings.HasPrefix(host, *expectedHost) {
		log.Fatalf("DATABASE_URL non punta al database atteso (%s): nessuna operazione eseguita.", *expectedHost)
	}

	if writeCommands[command] && !devenv.IsLocalHost(host) && !*yes &&
		!confirm(fmt.Sprintf("Eseguire \"%s\" su questo database NON locale? Prima crea un branch di backup su Neon.", command)) {
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

	if command == "grant-app" {
		grantApp(conn, ownerDSN, flag.Arg(1))
		return
	}

	if err := db.Migrate(context.Background(), conn, command); err != nil {
		log.Fatalf("Migrazione fallita: %v", err)
	}
}

// grantApp prepara il ruolo usato dall'app, con i soli permessi sui dati (modulo M3.6). La connessione
// deve essere quella del ruolo proprietario, che fa le migrazioni.
func grantApp(conn *sql.DB, ownerDSN, role string) {
	password, err := db.SetupAppRole(context.Background(), conn, role)
	if err != nil {
		log.Fatalf("Ruolo non preparato, nessuna modifica: %v", err)
	}
	if password == "" {
		log.Printf("Permessi di %q aggiornati: lettura e scrittura dei dati, nessuna modifica dello schema.", role)
		return
	}
	log.Printf("Ruolo %q creato: può leggere e scrivere i dati, non modificare lo schema.", role)
	fmt.Println()
	if appDSN, ok := devenv.AppNeonDSN(ownerDSN, role, password); ok {
		fmt.Println("Stringa di connessione dell'app, da copiare in Vercel → Settings → Environment Variables →")
		fmt.Println("DATABASE_URL (Production). Contiene la password, che non è salvata da nessuna parte e non verrà")
		fmt.Println("mostrata di nuovo: non incollarla in chat, email o documenti.")
		fmt.Println()
		fmt.Println(appDSN)
	} else {
		fmt.Println("Password del ruolo (non verrà mostrata di nuovo, non condividerla):")
		fmt.Println()
		fmt.Println(password)
	}
	fmt.Println()
}

func confirm(question string) bool {
	fmt.Printf("%s [s/N] ", question)
	answer, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	answer = strings.ToLower(strings.TrimSpace(answer))
	return answer == "s" || answer == "si" || answer == "sì"
}
