package handler

import (
	"database/sql"
	"net/http"
	"os"

	_ "github.com/lib/pq"
)

func DeleteListingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Query().Get("id")
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	_, err = db.Exec("DELETE FROM roomdate_app.listings WHERE id = $1", id)
	if err != nil {
		http.Error(w, "Errore cancellazione", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
