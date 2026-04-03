package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strconv" // <-- Aggiunto per convertire il budget in numero

	_ "github.com/lib/pq"
)

type ProfileRequest struct {
	UserID     string `json:"userId"`
	UserType   string `json:"userType"`  // <-- NUOVO
	Citta      string `json:"citta"`     // <-- NUOVO
	BudgetMax  string `json:"budgetMax"` // <-- NUOVO
	Occupation string `json:"occupation"`
	Birthdate  string `json:"birthdate"`
	Bio        string `json:"bio"`
	Tags       string `json:"tags"`
}

func ProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	var req ProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dati non validi", http.StatusBadRequest)
		return
	}

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// Convertiamo il budget da stringa a numero intero (se è vuoto, lo mettiamo a 0)
	budget := 0
	if req.BudgetMax != "" {
		budget, _ = strconv.Atoi(req.BudgetMax)
	}

	// AGGIORNATA LA QUERY PER SALVARE TUTTI I CAMPI
	query := `
		UPDATE roomdate_app.users 
		SET occupation = $1, birthdate = $2, bio = $3, lifestyle_tags = $4, user_type = $5, citta = $6, budget_max = $7
		WHERE id = $8
	`
	_, err = db.Exec(query, req.Occupation, req.Birthdate, req.Bio, req.Tags, req.UserType, req.Citta, budget, req.UserID)
	if err != nil {
		http.Error(w, "Errore durante il salvataggio: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Profilo aggiornato!"})
}
