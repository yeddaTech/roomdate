package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
)

type StartChatReq struct {
	ListingID int    `json:"listingId,omitempty"` // Ora è opzionale!
	TenantID  string `json:"tenantId"`
	TargetID  string `json:"targetId,omitempty"` // Nuovo: ID del coinquilino
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

	if req.ListingID != 0 {
		// LOGICA A: Chat per una stanza
		err = db.QueryRow("SELECT id FROM roomdate_app.conversations WHERE listing_id = $1 AND tenant_id = $2", req.ListingID, req.TenantID).Scan(&convId)
		if err == sql.ErrNoRows {
			err = db.QueryRow("INSERT INTO roomdate_app.conversations (listing_id, tenant_id) VALUES ($1, $2) RETURNING id", req.ListingID, req.TenantID).Scan(&convId)
		}
	} else if req.TargetID != "" {
		// LOGICA B: Chat Diretta tra due persone (Cerco Coinquilino)
		// Controlla se hanno già una chat aperta
		err = db.QueryRow(`
			SELECT id FROM roomdate_app.conversations 
			WHERE listing_id IS NULL 
			AND ((tenant_id = $1 AND user2_id = $2) OR (tenant_id = $2 AND user2_id = $1))
		`, req.TenantID, req.TargetID).Scan(&convId)

		if err == sql.ErrNoRows {
			err = db.QueryRow("INSERT INTO roomdate_app.conversations (tenant_id, user2_id) VALUES ($1, $2) RETURNING id", req.TenantID, req.TargetID).Scan(&convId)
		}
	} else {
		http.Error(w, "Manca ListingID o TargetID", http.StatusBadRequest)
		return
	}

	if err != nil && err != sql.ErrNoRows {
		http.Error(w, "Errore database: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]int{"conversationId": convId})
}
