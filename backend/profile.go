package backend

import (
	"encoding/json"
	"net/http"
	"strconv"

	_ "github.com/lib/pq"
	"github.com/microcosm-cc/bluemonday"
)

type ProfileRequest struct {
	UserType   string      `json:"userType"`
	Citta      string      `json:"citta"`
	BudgetMax  interface{} `json:"budgetMax"` // 👈 Flessibile: accetta sia stringhe che int dall'input JSON
	Occupation string      `json:"occupation"`
	Birthdate  string      `json:"birthdate"`
	Bio        string      `json:"bio"`
	Tags       string      `json:"tags"`
	IsPublic   bool        `json:"isPublic"`
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
	// --- GESTIONE CORS PREFLIGHT ---
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// --- 1. GESTIONE GET (Visualizzazione Profili) ---
	if r.Method == http.MethodGet {
		userId := r.URL.Query().Get("userId")

		// 👈 FALLBACK MUTUO: Se la richiesta frontend non passa un'id esplicito (es: caricamento dashboard propria),
		// leggiamo l'identità dell'utente dal cookie di sessione.
		if userId == "" {
			userId = getSecureUserID(r)
		}

		if userId == "" {
			http.Error(w, "Accesso negato: Sessione non valida o userId mancante", http.StatusUnauthorized)
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
		err := DB.QueryRow(query, userId).Scan(
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
		secureUserID := getSecureUserID(r)
		if secureUserID == "" {
			http.Error(w, "Accesso negato: Sessione non valida", http.StatusUnauthorized)
			return
		}

		var req ProfileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Dati non validi o formato JSON errato", http.StatusBadRequest)
			return
		}

		p := bluemonday.StrictPolicy()
		safeCitta := p.Sanitize(req.Citta)
		safeOccupation := p.Sanitize(req.Occupation)
		safeBio := p.Sanitize(req.Bio)
		safeTags := p.Sanitize(req.Tags)

		// Safe parsing del budget a prescindere dal tipo di dato ricevuto (stringa o numero)
		budget := 0
		switch v := req.BudgetMax.(type) {
		case string:
			if v != "" {
				budget, _ = strconv.Atoi(v)
			}
		case float64:
			budget = int(v)
		case int:
			budget = v
		}

		var err error

		query := `
            UPDATE roomdate_app.users 
            SET user_type = $1, citta = $2, budget_max = $3, occupation = $4, birthdate = $5, bio = $6, lifestyle_tags = $7, is_public = $8
            WHERE id = $9
        `
		_, err = DB.Exec(query, req.UserType, safeCitta, budget, safeOccupation, req.Birthdate, safeBio, safeTags, req.IsPublic, secureUserID)

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
