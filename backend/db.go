package backend

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/lib/pq"
)

// DB è la variabile globale esportata che userai in tutti i file dentro "backend"
var DB *sql.DB

func init() {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		return
	}

	var err error
	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Impossibile connettersi al database: %v", err)
	}

	// 🛡️ OTTIMIZZAZIONE POOL SERVERLESS
	DB.SetMaxOpenConns(10)
	DB.SetMaxIdleConns(2)

	if err = DB.Ping(); err != nil {
		log.Printf("Attenzione: Database non raggiungibile al momento del ping: %v", err)
	}
}
