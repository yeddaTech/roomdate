package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strconv"

	_ "github.com/lib/pq"
)

type ProfileRequest struct {
	UserID     string `json:"userId"`
	UserType   string `json:"userType"`
	Citta      string `json:"citta"`
	BudgetMax  string `json:"budgetMax"`
	Occupation string `json:"occupation"`
	Birthdate  string `json:"birthdate"`
	Bio        string `json:"bio"`
	Tags       string `json:"tags"`
	IsPublic   bool   `json:"isPublic"`
}

type UserProfile struct {
	ID            string `json:"id"`
	Nome          string `json:"nome"`
	Cognome       string `json:"cognome"`
	Email         string `json:"email"`
	UserType      string `json:"user_type"`
	Citta         string `json:"citta"`
	Nascita       string `json:"nascita"`
	BudgetMax     int    `json:"budget_max"`
	Occupation    string `json:"occupation"`
	Bio           string `json:"bio"`
	LifestyleTags string `json:"lifestyle_tags"`
	IsPublic      bool   `json:"is_public"` // <--- NUOVO 1: Aggiunto alla struct di risposta
}

func ProfileHandler(w http.ResponseWriter, r *http.Request) {
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// --- 1. GESTIONE GET (Scarica i dati freschi) ---
	if r.Method == http.MethodGet {
		userId := r.URL.Query().Get("userId")
		if userId == "" {
			http.Error(w, "Manca userId", http.StatusBadRequest)
			return
		}

		var p UserProfile

		// <--- NUOVO 2: Aggiunto COALESCE(is_public, true) alla query e &p.IsPublic allo Scan
		query := `
            SELECT id::text, first_name, last_name, email, 
                   COALESCE(user_type, ''), COALESCE(citta, ''), COALESCE(birthdate::text, ''), 
                   COALESCE(budget_max, 0), COALESCE(occupation, ''), COALESCE(bio, ''), COALESCE(lifestyle_tags, ''),
                   COALESCE(is_public, true)
            FROM roomdate_app.users WHERE id = $1
        `
		err := db.QueryRow(query, userId).Scan(
			&p.ID, &p.Nome, &p.Cognome, &p.Email,
			&p.UserType, &p.Citta, &p.Nascita, &p.BudgetMax,
			&p.Occupation, &p.Bio, &p.LifestyleTags,
			&p.IsPublic,
		)
		if err != nil {
			http.Error(w, "Utente non trovato", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(p)
		return
	}

	// --- 2. GESTIONE POST (Salva i dati) ---
	if r.Method == http.MethodPost {
		var req ProfileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Dati non validi", http.StatusBadRequest)
			return
		}

		budget := 0
		if req.BudgetMax != "" {
			budget, _ = strconv.Atoi(req.BudgetMax)
		}

		// <--- NUOVO 3: Aggiunto is_public = $8 nella query e req.IsPublic nei parametri di db.Exec
		query := `
            UPDATE roomdate_app.users 
            SET user_type = $1, citta = $2, budget_max = $3, occupation = $4, birthdate = $5, bio = $6, lifestyle_tags = $7, is_public = $8
            WHERE id = $9
        `
		_, err = db.Exec(query, req.UserType, req.Citta, budget, req.Occupation, req.Birthdate, req.Bio, req.Tags, req.IsPublic, req.UserID)

		if err != nil {
			http.Error(w, "Errore salvataggio: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Profilo aggiornato con successo"))
		return
	}

	http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
}
