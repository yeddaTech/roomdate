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
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Job      string   `json:"job"`
	Quote    string   `json:"quote"`
	Age      int      `json:"age"`
	City     string   `json:"city"`
	Match    int      `json:"match"`
	Color1   string   `json:"color1"`
	Color2   string   `json:"color2"`
	Emoji    string   `json:"emoji"`
	Tags     []string `json:"tags"`
	UserType string   `json:"user_type"`
	Budget   int      `json:"budget_max"` // <--- AGGIUNTO IL BUDGET
}

func GetRoommatesHandler(w http.ResponseWriter, r *http.Request) {
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// Estratto anche il budget_max
	query := `
        SELECT 
            id::text, 
            COALESCE(first_name, 'Utente'), 
            COALESCE(occupation, 'Studente/Lavoratore'), 
            COALESCE(bio, 'Ciao! Sto cercando una nuova casa e dei fantastici coinquilini.'), 
            COALESCE(lifestyle_tags, 'Socievole, Ordinato'),
            COALESCE(citta, ''),
            COALESCE(user_type, 'cerca'),
            COALESCE(budget_max, 0)
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

		// Aggiunto &rm.Budget allo Scan
		if err := rows.Scan(&rm.ID, &rm.Name, &rm.Job, &rm.Quote, &tagsStr, &rm.City, &rm.UserType, &rm.Budget); err != nil {
			http.Error(w, "Errore Scan: "+err.Error(), http.StatusInternalServerError)
			return
		}

		rm.Tags = strings.Split(tagsStr, ", ")

		rm.Age = 22 + (i % 6)
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
