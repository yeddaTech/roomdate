package backend

import (
	"database/sql"
	"encoding/json"
	"net/http"

	_ "github.com/lib/pq"
)

type StartChatReq struct {
	ListingID int    `json:"listingId,omitempty"`
	TargetID  string `json:"targetId,omitempty"`
}

func StartChatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	// 🛡️ ZERO-TRUST: Il Tenant (chi avvia la chat) è stabilito dal token
	secureTenantID := getSecureUserID(r)
	if secureTenantID == "" {
		http.Error(w, "Accesso negato: Sessione non valida", http.StatusUnauthorized)
		return
	}

	var req StartChatReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dati non validi", http.StatusBadRequest)
		return
	}

	var convId int
	var err error // ✅ DICHIARATA QUI CORRETTAMENTE

	if req.ListingID != 0 {
		// LOGICA A: Chat per una stanza
		err = DB.QueryRow("SELECT id FROM roomdate_app.conversations WHERE listing_id = $1 AND tenant_id = $2", req.ListingID, secureTenantID).Scan(&convId)
		if err == sql.ErrNoRows {
			err = DB.QueryRow("INSERT INTO roomdate_app.conversations (listing_id, tenant_id) VALUES ($1, $2) RETURNING id", req.ListingID, secureTenantID).Scan(&convId)
		}
	} else if req.TargetID != "" {
		// LOGICA B: Chat Diretta
		err = DB.QueryRow(`
            SELECT id FROM roomdate_app.conversations 
            WHERE listing_id IS NULL 
            AND ((tenant_id = $1 AND user2_id = $2) OR (tenant_id = $2 AND user2_id = $1))
        `, secureTenantID, req.TargetID).Scan(&convId)

		if err == sql.ErrNoRows {
			err = DB.QueryRow("INSERT INTO roomdate_app.conversations (tenant_id, user2_id) VALUES ($1, $2) RETURNING id", secureTenantID, req.TargetID).Scan(&convId)
		}
	} else {
		http.Error(w, "Manca ListingID o TargetID", http.StatusBadRequest)
		return
	}

	if err != nil && err != sql.ErrNoRows {
		http.Error(w, "Errore interno database", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]int{"conversationId": convId})
}
