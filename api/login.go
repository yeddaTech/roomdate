package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// Una singola struttura "jolly" che accetta tutti i possibili dati da React
type MultiRequest struct {
	Action      string `json:"action"` // "login", "update_password", o "delete_account"
	Email       string `json:"email"`
	Password    string `json:"password"`
	UserID      string `json:"userId"`
	NewPassword string `json:"newPassword"`
}

type UserData struct {
	ID       string `json:"id"`
	Nome     string `json:"nome"`
	Cognome  string `json:"cognome"`
	Email    string `json:"email"`
	UserType string `json:"user_type"`
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	var req MultiRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dati non validi", http.StatusBadRequest)
		return
	}

	// Connessione al DB unica per tutte le operazioni
	connStr := os.Getenv("DATABASE_URL")
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// LO SWITCH: Decide quale operazione eseguire!
	switch req.Action {

	// ==========================================
	// AZIONE 1: AGGIORNAMENTO PASSWORD
	// ==========================================
	case "update_password":
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "Errore crittografia", http.StatusInternalServerError)
			return
		}
		query := `UPDATE roomdate_app.users SET password_hash = $1 WHERE id = $2`
		_, err = db.Exec(query, hashedPassword, req.UserID)
		if err != nil {
			http.Error(w, "Errore DB: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Password aggiornata con successo"))
		return

	// ==========================================
	// AZIONE 2: ELIMINAZIONE ACCOUNT
	// ==========================================
	case "delete_account":
		query := `DELETE FROM roomdate_app.users WHERE id = $1`
		_, err = db.Exec(query, req.UserID)
		if err != nil {
			http.Error(w, "Errore DB: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Account eliminato"))
		return

	// ==========================================
	// AZIONE DI DEFAULT: LOGIN NORMALE
	// ==========================================
	default:
		var user UserData
		var hashedPassword string

		query := `SELECT id::text, first_name, last_name, email, password_hash, COALESCE(user_type, '') FROM roomdate_app.users WHERE email = $1`
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
}
