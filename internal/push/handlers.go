package push

import (
	"net/http"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/httpx"
)

var errSessionInvalid = apperr.Unauthorized("session_invalid", "Sessione scaduta: accedi di nuovo")

// Handler espone le API v1 delle notifiche push.
type Handler struct {
	svc      *Service
	sessions *auth.Manager
}

func NewHandler(svc *Service, sessions *auth.Manager) *Handler {
	return &Handler{svc: svc, sessions: sessions}
}

// Key gestisce GET /api/v1/push/key: la chiave con cui il browser si iscrive.
func (h *Handler) Key(w http.ResponseWriter, r *http.Request) {
	key, err := h.svc.PublicKey()
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"publicKey": key})
}

// Subscribe gestisce PUT /api/v1/me/push-subscriptions (l'iscrizione del browser).
func (h *Handler) Subscribe(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r.Context(), r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
		return
	}
	var in SubscriptionInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.svc.Subscribe(r.Context(), session, in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Unsubscribe gestisce DELETE /api/v1/me/push-subscriptions con {"endpoint": "..."}.
func (h *Handler) Unsubscribe(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r.Context(), r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
		return
	}
	var in struct {
		Endpoint string `json:"endpoint"`
	}
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.svc.Unsubscribe(r.Context(), session.UserID, in.Endpoint); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
