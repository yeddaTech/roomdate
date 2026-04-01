package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
)

// Definiamo esattamente la struttura che si aspetta la tua bellissima grafica React
type UIMessage struct {
	ID   int    `json:"id"`
	Type string `json:"type"` // "sent" o "received"
	Text string `json:"text"`
	Time string `json:"time"`
}

type UIListing struct {
	Emoji string `json:"emoji"`
	Title string `json:"title"`
	Price int    `json:"price"`
}

type UIConversation struct {
	ID       int         `json:"id"`
	Name     string      `json:"name"`
	Emoji    string      `json:"emoji"`
	Color1   string      `json:"color1"`
	Color2   string      `json:"color2"`
	Listing  UIListing   `json:"listing"`
	Messages []UIMessage `json:"messages"`
}

func GetChatsHandler(w http.ResponseWriter, r *http.Request) {
	userId := r.URL.Query().Get("userId")
	if userId == "" {
		http.Error(w, "User ID mancante", http.StatusBadRequest)
		return
	}

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// Trova tutte le conversazioni dove l'utente è coinvolto (come inquilino o come proprietario)
	queryChats := `
		SELECT c.id, l.title, l.price, u.first_name
		FROM roomdate_app.conversations c
		JOIN roomdate_app.listings l ON c.listing_id = l.id
		JOIN roomdate_app.users u ON l.user_id = u.id
		WHERE c.tenant_id = $1 OR l.user_id = $1
	`
	rows, err := db.Query(queryChats, userId)
	if err != nil {
		http.Error(w, "Errore query chat", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var chats []UIConversation
	colors := [][]string{{"#F5C29A", "#C4603A"}, {"#A8D8EA", "#4A90D9"}}

	i := 0
	for rows.Next() {
		var chat UIConversation
		chat.Messages = []UIMessage{} // Inizializza array vuoto
		var name sql.NullString

		rows.Scan(&chat.ID, &chat.Listing.Title, &chat.Listing.Price, &name)

		// Dati estetici
		chat.Emoji = "👤"
		chat.Color1 = colors[i%len(colors)][0]
		chat.Color2 = colors[i%len(colors)][1]
		chat.Listing.Emoji = "🏠"
		if name.Valid {
			chat.Name = name.String
		} else {
			chat.Name = "Utente"
		}

		// ORA PESCHIAMO I MESSAGGI REALI DI QUESTA CHAT!
		msgRows, _ := db.Query("SELECT id, sender_id, content, created_at FROM roomdate_app.messages WHERE conversation_id = $1 ORDER BY created_at ASC", chat.ID)

		for msgRows.Next() {
			var msg UIMessage
			var sender string
			var createdAt time.Time
			msgRows.Scan(&msg.ID, &sender, &msg.Text, &createdAt)

			// Se il sender sono io, il messaggio è "sent", altrimenti è "received"
			if sender == userId {
				msg.Type = "sent"
			} else {
				msg.Type = "received"
			}
			msg.Time = createdAt.Format("15:04") // Formatta l'ora (es: 10:32)

			chat.Messages = append(chat.Messages, msg)
		}
		msgRows.Close()

		chats = append(chats, chat)
		i++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chats)
}
