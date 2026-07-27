package backend

import (
	"encoding/json"
	"net/http"

	_ "github.com/lib/pq"
)

func GetMyListingsHandler(w http.ResponseWriter, r *http.Request) {
	// 🛡️ ZERO-TRUST: Estrazione sicura
	secureUserID := getSecureUserID(r)
	if secureUserID == "" {
		http.Error(w, "Accesso negato: Sessione non valida", http.StatusUnauthorized)
		return
	}

	// Usiamo secureUserID per la query
	rows, err := DB.Query("SELECT id, title, city, price, room_type FROM roomdate_app.listings WHERE user_id = $1 ORDER BY created_at DESC", secureUserID)
	if err != nil {
		http.Error(w, "Errore recupero annunci", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var myListings []map[string]interface{}
	for rows.Next() {
		var id int
		var title, city, roomType string
		var price int
		rows.Scan(&id, &title, &city, &price, &roomType)

		myListings = append(myListings, map[string]interface{}{
			"id": id, "title": title, "city": city, "price": price, "roomType": roomType,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(myListings)
}
