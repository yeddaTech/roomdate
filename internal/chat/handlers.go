package chat

import (
	"net/http"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/httpx"
)

// Handler espone le API v1 della chat: /api/v1/conversations.
type Handler struct {
	svc      *Service
	sessions *auth.Manager
}

func NewHandler(svc *Service, sessions *auth.Manager) *Handler {
	return &Handler{svc: svc, sessions: sessions}
}

var errSessionInvalid = apperr.Unauthorized("session_invalid", "Sessione scaduta: accedi di nuovo")

func (h *Handler) requireSession(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	session, ok := h.sessions.FromRequest(r.Context(), r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
	}
	return session, ok
}

// StartChat gestisce POST /api/v1/conversations con {"listingId": n} o {"targetId": "..."}.
func (h *Handler) StartChat(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
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
	httpx.JSON(w, http.StatusOK, map[string]int{"id": id})
}

// Conversations gestisce GET /api/v1/conversations?cursor=&limit=.
func (h *Handler) Conversations(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	query := r.URL.Query()
	page, err := h.svc.Conversations(r.Context(), session.UserID, query.Get("cursor"), query.Get("limit"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, page)
}

// Messages gestisce GET /api/v1/conversations/{id}/messages?cursor=&limit=.
func (h *Handler) Messages(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	query := r.URL.Query()
	page, err := h.svc.Messages(r.Context(), session.UserID, r.PathValue("id"), query.Get("cursor"), query.Get("limit"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, page)
}

// SendMessage gestisce POST /api/v1/conversations/{id}/messages.
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	var in SendMessageInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	saved, err := h.svc.SendMessage(r.Context(), session.UserID, r.PathValue("id"), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, saved)
}

// MarkRead gestisce POST /api/v1/conversations/{id}/read.
func (h *Handler) MarkRead(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	if err := h.svc.MarkRead(r.Context(), session.UserID, r.PathValue("id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Typing gestisce POST /api/v1/conversations/{id}/typing.
func (h *Handler) Typing(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	if err := h.svc.Typing(r.Context(), session.UserID, r.PathValue("id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
