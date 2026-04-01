package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// Dati che ci aspettiamo da React
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Dati che manderemo indietro a React se il login ha successo
// Dati che manderemo indietro a React se il login ha successo
type UserData struct {
	ID      string `json:"id"` // <--- CAMBIA QUI: da int a string!
	Nome    string `json:"nome"`
	Cognome string `json:"cognome"`
	Email   string `json:"email"`
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

	// 1. Cerchiamo l'utente tramite l'email
	var user UserData
	var hashedPassword string

	query := `SELECT id, first_name, last_name, email, password_hash FROM roomdate_app.users WHERE email = $1`
	err = db.QueryRow(query, req.Email).Scan(&user.ID, &user.Nome, &user.Cognome, &user.Email, &hashedPassword)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Email non trovata", http.StatusUnauthorized)
			return
		}
		// PRIMA ERA COSÌ: http.Error(w, "Errore del server", http.StatusInternalServerError)

		// ORA LO CAMBIAMO COSÌ PER VEDERE IL VERO ERRORE:
		http.Error(w, "Errore DB: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. Confrontiamo la password inserita con l'hash salvato nel database
	err = bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password))
	if err != nil {
		http.Error(w, "Password errata", http.StatusUnauthorized)
		return
	}

	// 3. Login effettuato! Restituiamo i dati dell'utente a React (senza la password ovviamente!)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Login effettuato con successo",
		"user":    user,
	})
}
