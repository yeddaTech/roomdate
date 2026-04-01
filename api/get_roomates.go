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

	// Cerchiamo utenti che hanno compilato la bio (quindi sono attivi)
	query := `SELECT id, first_name, occupation, bio, lifestyle_tags FROM roomdate_app.users WHERE bio IS NOT NULL LIMIT 4`
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
		var rawTags string
		if err := rows.Scan(&rm.ID, &rm.Name, &rm.Job, &rm.Quote, &rawTags); err != nil {
			continue
		}

		// Dati estetici / Finti per riempire la grafica
		rm.Age = 24 + i // Finto per ora
		rm.City = "In Italia"
		rm.Match = 85 + (i * 3)
		rm.Color1 = colors[i%len(colors)][0]
		rm.Color2 = colors[i%len(colors)][1]
		rm.Emoji = emojis[i%len(emojis)]

		// Dividiamo la stringa dei tag in un array
		if rawTags != "" {
			rm.Tags = strings.Split(rawTags, ", ")
		} else {
			rm.Tags = []string{"Nuovo utente"}
		}

		roommates = append(roommates, rm)
		i++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(roommates)
}
