package backend

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/pusher/pusher-http-go/v5"
)

// TypingPayload definisce i dati in arrivo da React.
// Il mittente NON arriva dal client: viene ricavato dalla sessione.
type TypingPayload struct {
	ConversationID string `json:"conversationId"`
}

func HandleTyping(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	// 1. 🛡️ ZERO-TRUST: il mittente è stabilito dal token
	secureSenderID := getSecureUserID(r)
	if secureSenderID == "" {
		http.Error(w, "Accesso negato: Sessione non valida", http.StatusUnauthorized)
		return
	}

	// 2. Parsing del JSON
	var payload TypingPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Payload non valido", http.StatusBadRequest)
		return
	}

	conversationID, err := strconv.Atoi(payload.ConversationID)
	if err != nil || conversationID <= 0 {
		http.Error(w, "Conversazione non valida", http.StatusBadRequest)
		return
	}

	// 3. Solo chi partecipa alla conversazione può segnalare che sta scrivendo
	isParticipant, err := isConversationParticipant(conversationID, secureSenderID)
	if err != nil {
		log.Printf("typing: verifica partecipante: %v", err)
		http.Error(w, "Errore interno del server", http.StatusInternalServerError)
		return
	}
	if !isParticipant {
		http.Error(w, "Accesso negato a questa conversazione", http.StatusForbidden)
		return
	}

	// 4. Inizializzazione sicura di Pusher con le variabili d'ambiente
	pusherClient := pusher.Client{
		AppID:   os.Getenv("PUSHER_APP_ID"),
		Key:     os.Getenv("PUSHER_KEY"),
		Secret:  os.Getenv("PUSHER_SECRET"),
		Cluster: os.Getenv("PUSHER_CLUSTER"),
		Secure:  true,
	}

	// 5. Trigger dell'evento sul canale globale "roomdate-channel"
	err = pusherClient.Trigger("roomdate-channel", "sta-scrivendo", map[string]string{
		"conversationId": strconv.Itoa(conversationID),
		"senderId":       secureSenderID,
	})

	if err != nil {
		log.Printf("typing: pusher: %v", err)
		http.Error(w, "Errore di trasmissione in tempo reale", http.StatusInternalServerError)
		return
	}

	// 6. Tutto ok, restituiamo 200 senza appesantire la rete
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}
