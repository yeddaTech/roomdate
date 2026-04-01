package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
)

func GetMyListingsHandler(w http.ResponseWriter, r *http.Request) {
	userId := r.URL.Query().Get("userId")
	if userId == "" {
		http.Error(w, "UserID mancante", http.StatusBadRequest)
		return
	}

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	rows, err := db.Query("SELECT id, title, city, price, room_type FROM roomdate_app.listings WHERE user_id = $1 ORDER BY created_at DESC", userId)
	if err != nil {
		http.Error(w, "Errore query", http.StatusInternalServerError)
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
