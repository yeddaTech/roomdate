package backend

import (
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"github.com/pusher/pusher-http-go/v5"
)

type SendMessageReq struct {
	ConversationID int    `json:"conversationId"`
	Text           string `json:"text"`       // Cifrato per il destinatario
	SenderText     string `json:"senderText"` // Cifrato per il mittente
}

func SendMessageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 🛡️ ZERO-TRUST: Identifichiamo il mittente in modo sicuro dal token JWT
	secureSenderID := getSecureUserID(r)
	if secureSenderID == "" {
		http.Error(w, "Accesso negato: Sessione non valida", http.StatusUnauthorized)
		return
	}

	var req SendMessageReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid data", http.StatusBadRequest)
		return
	}

	var err error // ✅ DICHIARATA QUI CORRETTAMENTE

	// Salvataggio su DB usando il secureSenderID (No XSS sanitize per non corrompere la cifratura)
	_, err = DB.Exec("INSERT INTO roomdate_app.messages (conversation_id, sender_id, content, sender_content) VALUES ($1, $2, $3, $4)",
		req.ConversationID, secureSenderID, req.Text, req.SenderText)

	if err != nil {
		http.Error(w, "Errore salvataggio: "+err.Error(), http.StatusInternalServerError)
		return
	}

	pusherClient := pusher.Client{
		AppID:   os.Getenv("PUSHER_APP_ID"),
		Key:     os.Getenv("PUSHER_KEY"),
		Secret:  os.Getenv("PUSHER_SECRET"),
		Cluster: os.Getenv("PUSHER_CLUSTER"),
		Secure:  true,
	}

	data := map[string]interface{}{"conversationId": req.ConversationID}
	pusherClient.Trigger("roomdate-channel", "nuovo-messaggio", data)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
