package backend

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/pusher/pusher-http-go/v5"
)

// TypingPayload definisce i dati in arrivo da React
type TypingPayload struct {
	ConversationID string `json:"conversationId"`
	SenderID       string `json:"senderId"`
}

func HandleTyping(w http.ResponseWriter, r *http.Request) {
	// 1. Gestione CORS (Indispensabile per le chiamate dal frontend)
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	if origin := r.Header.Get("Origin"); origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	}
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	// Risposta rapida per il preflight di sicurezza del browser
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	// 2. Parsing del JSON
	var payload TypingPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Payload non valido", http.StatusBadRequest)
		return
	}

	// Validazione base
	if payload.ConversationID == "" || payload.SenderID == "" {
		http.Error(w, "Parametri mancanti", http.StatusBadRequest)
		return
	}

	// 3. Inizializzazione sicura di Pusher con le variabili d'ambiente
	pusherClient := pusher.Client{
		AppID:   os.Getenv("PUSHER_APP_ID"),
		Key:     os.Getenv("PUSHER_KEY"),
		Secret:  os.Getenv("PUSHER_SECRET"),
		Cluster: os.Getenv("PUSHER_CLUSTER"),
		Secure:  true,
	}

	// 4. Trigger dell'evento sul canale globale "roomdate-channel"
	err := pusherClient.Trigger("roomdate-channel", "sta-scrivendo", map[string]string{
		"conversationId": payload.ConversationID,
		"senderId":       payload.SenderID,
	})

	if err != nil {
		http.Error(w, "Errore di trasmissione in tempo reale", http.StatusInternalServerError)
		return
	}

	// 5. Tutto ok, restituiamo 200 senza appesantire la rete
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}
