package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	Nome     string `json:"nome"`
	Cognome  string `json:"cognome"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Citta    string `json:"citta"`
	UserType string `json:"userType"`
	Nascita  string `json:"nascita"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	db, err := sql.Open("postgres", os.Getenv("POSTGRES_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dati non validi", http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Errore sicurezza", http.StatusInternalServerError)
		return
	}

	// NOTA IL roomdate_app. AGGIUNTO QUI SOTTO
	query := `INSERT INTO roomdate_app.users (first_name, last_name, email, password_hash, citta, user_type, birthdate) 
	          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`

	var newID int
	err = db.QueryRow(query, req.Nome, req.Cognome, req.Email, string(hashedPassword), req.Citta, req.UserType, req.Nascita).Scan(&newID)

	if err != nil {
		// BASTA MESSAGGI GENERICI! Ora stampiamo il vero errore di Postgres
		http.Error(w, "ERRORE REALE DEL DB: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "success", "userId": newID})
}
