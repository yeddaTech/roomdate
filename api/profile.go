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
	BudgetMax  string `json:"budgetMax"` // Lo riceviamo come stringa da React
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

	// Convertiamo il budget da stringa a numero intero (se è vuoto diventa 0)
	budget := 0
	if req.BudgetMax != "" {
		budget, _ = strconv.Atoi(req.BudgetMax)
	}

	// Salviamo tutto nel DB
	query := `
        UPDATE roomdate_app.users 
        SET user_type = $1, citta = $2, budget_max = $3, occupation = $4, birthdate = $5, bio = $6, lifestyle_tags = $7
        WHERE id = $8
    `
	_, err = db.Exec(query, req.UserType, req.Citta, budget, req.Occupation, req.Birthdate, req.Bio, req.Tags, req.UserID)

	if err != nil {
		http.Error(w, "Errore salvataggio: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Profilo aggiornato con successo"))
}
