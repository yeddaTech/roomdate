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

	// Prende il numero della stanza dall'URL (es: id=2)
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID mancante", http.StatusBadRequest)
		return
	}

	var l ListingDetail
	var firstName sql.NullString
	var err error // ✅ DICHIARATA CORRETTAMENTE QUI

	// Cerca la stanza specifica e il nome del proprietario usando la variabile globale DB
	query := `
        SELECT l.id, l.title, l.city, l.zone, l.price, l.room_type, l.description, u.first_name
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

	// Dati finti SOLO per la grafica delle foto e icone (perché non le salviamo ancora nel DB)
	l.Features = []string{"Wi-Fi", "Lavatrice", "Arredata", "Luminosa"}
	l.Images = []string{
		"https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
		"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
		"https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
	}

	// Impostiamo il vero nome del proprietario
	name := "Proprietario"
	if firstName.Valid && firstName.String != "" {
		name = firstName.String
	}
	l.Landlord = Landlord{Name: name, Role: "Proprietario/a", Emoji: "👋"}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(l)
}
