package backend

import (
	"database/sql"
	"encoding/json"
	"net/http"

	_ "github.com/lib/pq"
)

type Landlord struct {
	Name  string `json:"name"`
	Role  string `json:"role"`
	Emoji string `json:"emoji"`
}

type ListingDetail struct {
	ID          int      `json:"id"`
	Title       string   `json:"title"`
	City        string   `json:"city"`
	Zone        string   `json:"zone"`
	Price       int      `json:"price"`
	Type        string   `json:"type"`
	Description string   `json:"description"`
	Features    []string `json:"features"`
	Images      []string `json:"images"`
	Landlord    Landlord `json:"landlord"`
}

func GetListingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID mancante", http.StatusBadRequest)
		return
	}

	var l ListingDetail
	var firstName sql.NullString
	var err error

	// 🔴 FIX: COALESCE applicato anche qui per sicurezza assoluta
	query := `
        SELECT 
            l.id, 
            COALESCE(l.title, ''), 
            COALESCE(l.city, ''), 
            COALESCE(l.zone, ''), 
            COALESCE(l.price, 0), 
            COALESCE(l.room_type, ''), 
            COALESCE(l.description, ''), 
            u.first_name
        FROM roomdate_app.listings l
        LEFT JOIN roomdate_app.users u ON l.user_id = u.id
        WHERE l.id = $1
    `
	err = DB.QueryRow(query, id).Scan(&l.ID, &l.Title, &l.City, &l.Zone, &l.Price, &l.Type, &l.Description, &firstName)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Annuncio non trovato nel Database", http.StatusNotFound)
		} else {
			http.Error(w, "Errore query", http.StatusInternalServerError)
		}
		return
	}

	// Dati finti SOLO per la grafica
	l.Features = []string{"Wi-Fi", "Lavatrice", "Arredata", "Luminosa"}
	l.Images = []string{
		"https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
		"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
		"https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
	}

	name := "Proprietario"
	if firstName.Valid && firstName.String != "" {
		name = firstName.String
	}
	l.Landlord = Landlord{Name: name, Role: "Proprietario/a", Emoji: "👋"}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(l)
}
