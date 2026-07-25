package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"github.com/pusher/pusher-http-go/v5"
)

type SendMessageReq struct {
	ConversationID int    `json:"conversationId"`
	SenderID       string `json:"senderId"`
	Text           string `json:"text"`
	SenderText     string `json:"senderText"` // 🔐 NUOVO: Riceve il testo cifrato per il mittente
}

func SendMessageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SendMessageReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid data", http.StatusBadRequest)
		return
	}

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// 1. Salva il messaggio su Neon
	// 🔐 AGGIORNATO: Ora salva sia "content" che "sender_content"
	_, err = db.Exec("INSERT INTO roomdate_app.messages (conversation_id, sender_id, content, sender_content) VALUES ($1, $2, $3, $4)",
		req.ConversationID, req.SenderID, req.Text, req.SenderText)

	if err != nil {
		http.Error(w, "Errore salvataggio: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. CONFIGURA PUSHER (Mantenuto esattamente come il tuo originale)
	pusherClient := pusher.Client{
		AppID:   os.Getenv("PUSHER_APP_ID"),
		Key:     os.Getenv("PUSHER_KEY"),
		Secret:  os.Getenv("PUSHER_SECRET"),
		Cluster: os.Getenv("PUSHER_CLUSTER"),
		Secure:  true,
	}

	// 3. Suona il campanello in tempo reale!
	// Dice a Pusher: "Sulla chat globale, c'è un 'nuovo-messaggio'"
	data := map[string]interface{}{"conversationId": req.ConversationID}
	pusherClient.Trigger("roomdate-channel", "nuovo-messaggio", data)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
