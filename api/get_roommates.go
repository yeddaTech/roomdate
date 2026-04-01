package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strings"

	_ "github.com/lib/pq"
)

type Roommate struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Job    string   `json:"job"`
	Quote  string   `json:"quote"`
	Age    int      `json:"age"`
	City   string   `json:"city"`
	Match  int      `json:"match"`
	Color1 string   `json:"color1"`
	Color2 string   `json:"color2"`
	Emoji  string   `json:"emoji"`
	Tags   []string `json:"tags"`
}

func GetRoommatesHandler(w http.ResponseWriter, r *http.Request) {
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// LA SUPER QUERY: Postgres riempie i buchi (NULL) e formatta l'ID prima di darli a Go!
	query := `
		SELECT 
			id::text, 
			COALESCE(first_name, 'Utente'), 
			COALESCE(occupation, 'Studente/Lavoratore'), 
			COALESCE(bio, 'Ciao! Sto cercando una nuova casa e dei fantastici coinquilini.'), 
			COALESCE(lifestyle_tags, 'Socievole, Ordinato') 
		FROM roomdate_app.users 
		LIMIT 8
	`
	rows, err := db.Query(query)
	if err != nil {
		http.Error(w, "Errore query", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var roommates []Roommate
	colors := [][]string{{"#F5C29A", "#C4603A"}, {"#C4A882", "#7A4B2A"}, {"#D4B896", "#9A4628"}, {"#EAF3DE", "#4CAF50"}}
	emojis := []string{"👩", "👨", "👩‍🎓", "👨‍🎨"}
	i := 0

	for rows.Next() {
		var rm Roommate
		var tagsStr string

		// Ora la lettura (Scan) è semplicissima e a prova di bomba
		if err := rows.Scan(&rm.ID, &rm.Name, &rm.Job, &rm.Quote, &tagsStr); err != nil {
			// Se fallisce, non stiamo più in silenzio, ma facciamo crashare l'API per leggere l'errore vero!
			http.Error(w, "Errore Scan: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Dividiamo i tag
		rm.Tags = strings.Split(tagsStr, ", ")

		// Dati grafici finti per riempire le card
		rm.Age = 22 + (i % 6)
		rm.City = "In Italia"
		rm.Match = 85 + (i * 2)
		rm.Color1 = colors[i%len(colors)][0]
		rm.Color2 = colors[i%len(colors)][1]
		rm.Emoji = emojis[i%len(emojis)]

		roommates = append(roommates, rm)
		i++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(roommates)
}
