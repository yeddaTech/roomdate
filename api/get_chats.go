package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
)

type UIMessage struct {
	ID   int    `json:"id"`
	Type string `json:"type"`
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

	// MAGIA SQL: Usa LEFT JOIN così non va in crash se la chat è senza stanza
	queryChats := `
		SELECT 
			c.id, 
			COALESCE(l.title, 'Chat Diretta') as title, 
			COALESCE(l.price, 0) as price,
			CASE 
				WHEN c.listing_id IS NOT NULL THEN
					CASE WHEN c.tenant_id::text = $1 THEN owner.first_name ELSE tenant.first_name END
				ELSE
					CASE WHEN c.tenant_id::text = $1 THEN u2.first_name ELSE tenant.first_name END
			END as other_user_name
		FROM roomdate_app.conversations c
		LEFT JOIN roomdate_app.listings l ON c.listing_id = l.id
		LEFT JOIN roomdate_app.users owner ON l.user_id = owner.id
		LEFT JOIN roomdate_app.users tenant ON c.tenant_id = tenant.id
		LEFT JOIN roomdate_app.users u2 ON c.user2_id = u2.id
		WHERE c.tenant_id::text = $1 OR l.user_id::text = $1 OR c.user2_id::text = $1
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
		chat.Messages = []UIMessage{}
		var name sql.NullString

		rows.Scan(&chat.ID, &chat.Listing.Title, &chat.Listing.Price, &name)

		chat.Emoji = "👤"
		chat.Color1 = colors[i%len(colors)][0]
		chat.Color2 = colors[i%len(colors)][1]

		if chat.Listing.Price == 0 {
			chat.Listing.Emoji = "💬" // Icona diversa per le chat dirette
		} else {
			chat.Listing.Emoji = "🏠"
		}

		if name.Valid && name.String != "" {
			chat.Name = name.String
		} else {
			chat.Name = "Utente Sconosciuto"
		}

		msgRows, _ := db.Query("SELECT id, sender_id, content, created_at FROM roomdate_app.messages WHERE conversation_id = $1 ORDER BY created_at ASC", chat.ID)

		for msgRows.Next() {
			var msg UIMessage
			var sender string
			var createdAt time.Time
			msgRows.Scan(&msg.ID, &sender, &msg.Text, &createdAt)

			if sender == userId {
				msg.Type = "sent"
			} else {
				msg.Type = "received"
			}
			msg.Time = createdAt.Format("15:04")
			chat.Messages = append(chat.Messages, msg)
		}
		msgRows.Close()

		chats = append(chats, chat)
		i++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chats)
}
