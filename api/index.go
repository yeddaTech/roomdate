package handler

import (
	"net/http"
	"strings"

	"roomdate-backend/backend"
)

// Handler è L'UNICA funzione che Vercel esporrà ed eseguirà
func Handler(w http.ResponseWriter, r *http.Request) {
	// Gestione CORS per il preflight request (OPTIONS)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Estraiamo l'endpoint richiesto
	path := strings.TrimPrefix(r.URL.Path, "/api/")

	// Smistiamo il traffico alla funzione corretta nel pacchetto "backend"
	switch path {
	case "login":
		backend.LoginHandler(w, r)
	case "register":
		backend.RegisterHandler(w, r)
	case "get_chats":
		backend.GetChatsHandler(w, r)
	case "start_chat":
		backend.StartChatHandler(w, r)
	case "profile":
		backend.ProfileHandler(w, r)
	case "create_listing":
		backend.CreateListingHandler(w, r)
	case "get_my_listings":
		backend.GetMyListingsHandler(w, r)
	case "delete_listing":
		backend.DeleteListingHandler(w, r)
	case "get_listing":
		backend.GetListingHandler(w, r)
	case "send_message":
		backend.SendMessageHandler(w, r)
	// Se hai altri endpoint (es. auth_check), aggiungili semplicemente come "case" qui sotto
	case "get_roommates":
		backend.GetRoommatesHandler(w, r)
	case "typing":
		backend.HandleTyping(w, r)
	default:
		http.Error(w, "Endpoint non trovato", http.StatusNotFound)
	}
}
