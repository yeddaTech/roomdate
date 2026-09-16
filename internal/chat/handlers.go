package chat

import (
	"net/http"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/httpx"
)

var errSessionInvalid = apperr.Unauthorized("session_invalid", "Sessione scaduta: accedi di nuovo")

// Handler espone le API legacy della chat, con percorsi e formati usati dal frontend attuale.
type Handler struct {
	svc      *Service
	sessions *auth.Manager
}

func NewHandler(svc *Service, sessions *auth.Manager) *Handler {
	return &Handler{svc: svc, sessions: sessions}
}

// StartChat gestisce POST /api/start_chat.
func (h *Handler) StartChat(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
		return
	}
	var in StartChatInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	id, err := h.svc.StartChat(r.Context(), session.UserID, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]int{"conversationId": id})
}

// Conversations gestisce GET /api/get_chats.
func (h *Handler) Conversations(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
		return
	}
	conversations, err := h.svc.Conversations(r.Context(), session.UserID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, conversations)
}

// SendMessage gestisce POST /api/send_message.
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
		return
	}
	var in SendMessageInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.svc.SendMessage(r.Context(), session.UserID, in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Typing gestisce POST /api/typing.
func (h *Handler) Typing(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
		return
	}
	var in struct {
		ConversationID string `json:"conversationId"`
	}
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.svc.Typing(r.Context(), session.UserID, in.ConversationID); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
