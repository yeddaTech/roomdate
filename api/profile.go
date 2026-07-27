package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strconv"

	_ "github.com/lib/pq"
	"github.com/microcosm-cc/bluemonday"
)

type ProfileRequest struct {
	// L'ID utente per l'update lo prendiamo dal token, non dal JSON
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
	IsPublic      bool   `json:"is_public"`
}

func ProfileHandler(w http.ResponseWriter, r *http.Request) {
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// --- 1. GESTIONE GET (Visualizzazione Profili) ---
	if r.Method == http.MethodGet {
		userId := r.URL.Query().Get("userId")
		if userId == "" {
			http.Error(w, "Manca userId", http.StatusBadRequest)
			return
		}

		var p UserProfile
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

	// --- 2. GESTIONE POST (Aggiornamento Profilo - ZERO TRUST & XSS) ---
	if r.Method == http.MethodPost {
		// 🛡️ ZERO-TRUST: Chi sta cercando di modificare il profilo?
		secureUserID := getSecureUserID(r)
		if secureUserID == "" {
			http.Error(w, "Accesso negato: Sessione non valida", http.StatusUnauthorized)
			return
		}

		var req ProfileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Dati non validi", http.StatusBadRequest)
			return
		}

		// 🧼 SANITIZZAZIONE XSS per i campi di testo libero
		p := bluemonday.StrictPolicy()
		safeCitta := p.Sanitize(req.Citta)
		safeOccupation := p.Sanitize(req.Occupation)
		safeBio := p.Sanitize(req.Bio)
		safeTags := p.Sanitize(req.Tags)
		// Non sanitizziamo Birthdate e UserType perché dovrebbero avere formati rigidi validati a monte

		budget := 0
		if req.BudgetMax != "" {
			budget, _ = strconv.Atoi(req.BudgetMax)
		}

		// 🛡️ L'UPDATE usa secureUserID, non il dato del client
		query := `
            UPDATE roomdate_app.users 
            SET user_type = $1, citta = $2, budget_max = $3, occupation = $4, birthdate = $5, bio = $6, lifestyle_tags = $7, is_public = $8
            WHERE id = $9
        `
		_, err = db.Exec(query, req.UserType, safeCitta, budget, safeOccupation, req.Birthdate, safeBio, safeTags, req.IsPublic, secureUserID)

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
