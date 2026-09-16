package listings

import (
	"net/http"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/httpx"
)

var errSessionInvalid = apperr.Unauthorized("session_invalid", "Accesso negato: Sessione non valida")

// Handler espone le API legacy degli annunci, con percorsi e formati usati dal frontend attuale.
type Handler struct {
	svc      *Service
	sessions *auth.Manager
}

func NewHandler(svc *Service, sessions *auth.Manager) *Handler {
	return &Handler{svc: svc, sessions: sessions}
}

// Create gestisce POST /api/create_listing.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
		return
	}
	var in CreateInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.svc.Create(r.Context(), session, in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]string{"message": "Annuncio pubblicato in sicurezza!"})
}

// Latest gestisce GET /api/get_listings.
func (h *Handler) Latest(w http.ResponseWriter, r *http.Request) {
	listings, err := h.svc.Latest(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, listings)
}

// Get gestisce GET /api/get_listing?id=.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	detail, err := h.svc.Get(r.Context(), r.URL.Query().Get("id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, detail)
}

// Mine gestisce GET /api/get_my_listings.
func (h *Handler) Mine(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
		return
	}
	listings, err := h.svc.Mine(r.Context(), session.UserID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, listings)
}

// Delete gestisce DELETE /api/delete_listing?id=.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
		return
	}
	if err := h.svc.Delete(r.Context(), session, r.URL.Query().Get("id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Text(w, http.StatusOK, "Annuncio eliminato con successo")
}
