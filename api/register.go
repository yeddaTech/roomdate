package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// Aggiungiamo alla struttura i campi del profilo che React ci sta inviando
type RegisterRequest struct {
	Nome     string `json:"nome"`
	Cognome  string `json:"cognome"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Citta    string `json:"citta"`
	UserType string `json:"userType"`
	Nascita  string `json:"nascita"`
	// --- NUOVI CAMPI PROFILO ---
	BudgetMax     int    `json:"budgetMax"`
	Occupation    string `json:"occupation"`
	Bio           string `json:"bio"`
	LifestyleTags string `json:"lifestyle_tags"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
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

	// AGGIORNATA LA QUERY: Inseriamo anche i nuovi campi
	query := `INSERT INTO roomdate_app.users 
              (first_name, last_name, email, password_hash, citta, user_type, birthdate, budget_max, occupation, bio, lifestyle_tags) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`

	var newID string
	// AGGIORNATA LA FUNZIONE: Passiamo tutti i nuovi req.Valore alla query
	err = db.QueryRow(
		query,
		req.Nome,
		req.Cognome,
		req.Email,
		string(hashedPassword),
		req.Citta,
		req.UserType,
		req.Nascita,
		req.BudgetMax,
		req.Occupation,
		req.Bio,
		req.LifestyleTags,
	).Scan(&newID)

	if err != nil {
		// BASTA MESSAGGI GENERICI! Ora stampiamo il vero errore di Postgres
		http.Error(w, "ERRORE REALE DEL DB: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "success", "userId": newID})
}
