package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq" // Driver per Postgres (Neon)
	"golang.org/x/crypto/bcrypt"
)

// Questa struct definisce la forma dei dati in arrivo da React
type RegisterRequest struct {
	Nome     string `json:"nome"`
	Cognome  string `json:"cognome"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Handler è la funzione eseguita da Vercel quando React chiama /api/register
func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Accettiamo solo richieste POST (invio dati)
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	// 2. Leggiamo il JSON inviato da React
	var req RegisterRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Errore nella lettura dei dati", http.StatusBadRequest)
		return
	}

	// 3. Criptiamo la password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		http.Error(w, "Errore nella generazione della password", http.StatusInternalServerError)
		return
	}

	// 4. Ci connettiamo al database Neon
	connStr := os.Getenv("DATABASE_URL")
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		http.Error(w, "Errore di connessione al DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// 5. Inseriamo l'utente nella tabella (usiamo lo schema roomdate_app creato prima)
	query := `
		INSERT INTO roomdate_app.users (email, password_hash, first_name, last_name) 
		VALUES ($1, $2, $3, $4)
	`
	_, err = db.Exec(query, req.Email, string(hashedPassword), req.Nome, req.Cognome)
	if err != nil {
		// Probabilmente l'email esiste già, essendo UNIQUE nel DB
		http.Error(w, "Errore durante il salvataggio o email già registrata", http.StatusConflict)
		return
	}

	// 6. Successo! Diciamo a React che è andato tutto bene
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated) // HTTP 201: Created
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Utente registrato con successo!",
	})
}
