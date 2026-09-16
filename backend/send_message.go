package backend

import (
	"encoding/json"
	"log"
	"net/http"

	_ "github.com/lib/pq"
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

	if req.ConversationID <= 0 {
		http.Error(w, "Conversazione non valida", http.StatusBadRequest)
		return
	}

	// 🛡️ Si può scrivere solo nelle conversazioni di cui si fa parte
	isParticipant, err := isConversationParticipant(req.ConversationID, secureSenderID)
	if err != nil {
		log.Printf("send_message: verifica partecipante: %v", err)
		http.Error(w, "Errore interno del server", http.StatusInternalServerError)
		return
	}
	if !isParticipant {
		http.Error(w, "Accesso negato a questa conversazione", http.StatusForbidden)
		return
	}

	// Salvataggio su DB usando il secureSenderID (No XSS sanitize per non corrompere la cifratura)
	_, err = DB.Exec("INSERT INTO roomdate_app.messages (conversation_id, sender_id, content, sender_content) VALUES ($1, $2, $3, $4)",
		req.ConversationID, secureSenderID, req.Text, req.SenderText)

	if err != nil {
		log.Printf("send_message: salvataggio: %v", err)
		http.Error(w, "Impossibile inviare il messaggio", http.StatusInternalServerError)
		return
	}

	data := map[string]interface{}{"conversationId": req.ConversationID}
	triggerRealtime("nuovo-messaggio", data)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
