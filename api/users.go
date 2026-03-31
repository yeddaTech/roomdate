package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq" // Importa il driver di Postgres
)

// Questa struct rappresenta un esempio di risposta JSON
type Response struct {
	Message string `json:"message"`
	Status  string `json:"status"`
}

// Handler è la funzione che Vercel esegue quando chiami /api/users
func Handler(w http.ResponseWriter, r *http.Request) {
	// 1. Recupera la stringa di connessione dalle variabili d'ambiente
	connStr := os.Getenv("DATABASE_URL")

	// 2. Apri la connessione con Neon
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		http.Error(w, "Errore di configurazione del DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// 3. Verifica che il DB sia raggiungibile (Ping)
	err = db.Ping()
	if err != nil {
		http.Error(w, "Impossibile connettersi a Neon", http.StatusInternalServerError)
		return
	}

	// 4. Se tutto va bene, rispondi con un JSON
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	json.NewEncoder(w).Encode(Response{
		Message: "Connesso con successo al database Neon da Golang!",
		Status:  "success",
	})
}
