package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
)

type ProfileRequest struct {
	UserID     string `json:"userId"`
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

	query := `
		UPDATE roomdate_app.users 
		SET occupation = $1, birthdate = $2, bio = $3, lifestyle_tags = $4 
		WHERE id = $5
	`
	_, err = db.Exec(query, req.Occupation, req.Birthdate, req.Bio, req.Tags, req.UserID)
	if err != nil {
		http.Error(w, "Errore durante il salvataggio: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Profilo aggiornato!"})
}
