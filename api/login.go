package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// ABBIAMO AGGIUNTO USERTYPE QUI SOTTO
type UserData struct {
	ID       string `json:"id"`
	Nome     string `json:"nome"`
	Cognome  string `json:"cognome"`
	Email    string `json:"email"`
	UserType string `json:"user_type"` // <--- FONDAMENTALE PER REACT!
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dati non validi", http.StatusBadRequest)
		return
	}

	connStr := os.Getenv("DATABASE_URL")
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	var user UserData
	var hashedPassword string

	// AGGIUNTO user_type (con COALESCE per evitare crash se il campo è vuoto nel DB)
	query := `SELECT id::text, first_name, last_name, email, password_hash, COALESCE(user_type, '') FROM roomdate_app.users WHERE email = $1`

	// AGGIUNTO &user.UserType nello Scan
	err = db.QueryRow(query, req.Email).Scan(&user.ID, &user.Nome, &user.Cognome, &user.Email, &hashedPassword, &user.UserType)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Email non trovata", http.StatusUnauthorized)
			return
		}
		http.Error(w, "Errore DB: "+err.Error(), http.StatusInternalServerError)
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password))
	if err != nil {
		http.Error(w, "Password errata", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Login effettuato con successo",
		"user":    user,
	})
}
