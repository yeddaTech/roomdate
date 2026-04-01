package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
)

type StartChatReq struct {
	ListingID int    `json:"listingId"`
	TenantID  string `json:"tenantId"`
}

func StartChatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	var req StartChatReq
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

	var convId int

	// 1. Controlla se esiste già una conversazione tra questo utente e questo annuncio
	err = db.QueryRow("SELECT id FROM roomdate_app.conversations WHERE listing_id = $1 AND tenant_id = $2", req.ListingID, req.TenantID).Scan(&convId)

	if err == sql.ErrNoRows {
		// 2. Se non esiste, CREA LA NUOVA CONVERSAZIONE!
		err = db.QueryRow("INSERT INTO roomdate_app.conversations (listing_id, tenant_id) VALUES ($1, $2) RETURNING id", req.ListingID, req.TenantID).Scan(&convId)
		if err != nil {
			http.Error(w, "Errore creazione chat: "+err.Error(), http.StatusInternalServerError)
			return
		}
	} else if err != nil {
		http.Error(w, "Errore ricerca chat: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]int{"conversationId": convId})
}
