package backend

import (
	"encoding/json"
	"net/http"

	_ "github.com/lib/pq"
)

// Questa struct è identica a come React si aspetta i dati
type Listing struct {
	ID    int      `json:"id"`
	Title string   `json:"title"`
	City  string   `json:"city"`
	Zone  string   `json:"zone"`
	Price int      `json:"price"`
	Color string   `json:"color"`
	Emoji string   `json:"emoji"`
	Avail bool     `json:"avail"`
	Tags  []string `json:"tags"`
}

func GetListingsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	var err error

	// Peschiamo gli ultimi 6 annunci dal database usando la variabile globale DB
	rows, err := DB.Query("SELECT id, title, city, zone, room_type, price FROM roomdate_app.listings ORDER BY created_at DESC LIMIT 6")
	if err != nil {
		http.Error(w, "Errore query", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var listings []Listing
	colors := []string{"#F5E3CC", "#D4835E", "#C4603A", "#EAF3DE", "#FBF3E8"}
	emojis := []string{"🛏️", "🛋️", "🪴", "☀️", "🖼️"}
	i := 0

	for rows.Next() {
		var l Listing
		var roomType string
		if err := rows.Scan(&l.ID, &l.Title, &l.City, &l.Zone, &roomType, &l.Price); err != nil {
			continue
		}

		// Aggiungiamo un po' di design finto per la grafica
		l.Color = colors[i%len(colors)]
		l.Emoji = emojis[i%len(emojis)]
		l.Avail = true
		l.Tags = []string{roomType, "Verificato"}

		listings = append(listings, l)
		i++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(listings)
}
