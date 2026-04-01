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

	// Prendiamo tutti gli utenti (massimo 8)
	query := `SELECT id, first_name, occupation, bio, lifestyle_tags FROM roomdate_app.users LIMIT 8`
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
		// Usiamo NullString per evitare crash se nel DB questi campi sono vuoti (NULL)
		var job, quote, rawTags sql.NullString

		if err := rows.Scan(&rm.ID, &rm.Name, &job, &quote, &rawTags); err != nil {
			continue
		}

		// Se l'utente non ha compilato il profilo, mettiamo dati di default!
		rm.Job = "Studente/Lavoratore"
		if job.Valid && job.String != "" {
			rm.Job = job.String
		}

		rm.Quote = "Ciao! Sto cercando una nuova casa e dei fantastici coinquilini."
		if quote.Valid && quote.String != "" {
			rm.Quote = quote.String
		}

		tagsStr := "Socievole, Ordinato"
		if rawTags.Valid && rawTags.String != "" {
			tagsStr = rawTags.String
		}
		rm.Tags = strings.Split(tagsStr, ", ")

		rm.Age = 22 + (i % 6) // Età finta per ora
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
