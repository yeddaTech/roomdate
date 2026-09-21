package moderation

import (
	"net/http"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/httpx"
)

// Handler espone blocchi (/api/v1/me/blocks), segnalazioni (/api/v1/reports) e l'area di
// moderazione (/api/v1/admin/...).
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

// Blocks gestisce GET /api/v1/me/blocks: gli utenti bloccati.
func (h *Handler) Blocks(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	blocks, err := h.svc.Blocks(r.Context(), session.UserID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": blocks})
}

// Block gestisce PUT /api/v1/me/blocks/{userId}.
func (h *Handler) Block(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	if err := h.svc.Block(r.Context(), session.UserID, r.PathValue("userId")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Unblock gestisce DELETE /api/v1/me/blocks/{userId}.
func (h *Handler) Unblock(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	if err := h.svc.Unblock(r.Context(), session.UserID, r.PathValue("userId")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Report gestisce POST /api/v1/reports: 201 per una segnalazione nuova, 200 se era già aperta.
func (h *Handler) Report(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	var in ReportInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	id, created, err := h.svc.Report(r.Context(), session.UserID, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	httpx.JSON(w, status, map[string]int64{"id": id})
}

// AdminReports gestisce GET /api/v1/admin/reports?status=open|closed&cursor=.
func (h *Handler) AdminReports(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	result, err := h.svc.AdminReports(r.Context(), session.UserID, q.Get("status"), q.Get("cursor"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, result)
}

// ResolveReport gestisce POST /api/v1/admin/reports/{id}/resolve con {"action", "note"}.
func (h *Handler) ResolveReport(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	var in ResolveInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.svc.Resolve(r.Context(), session.UserID, r.PathValue("id"), in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Unsuspend gestisce POST /api/v1/admin/users/{id}/unsuspend.
func (h *Handler) Unsuspend(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	if err := h.svc.Unsuspend(r.Context(), session.UserID, r.PathValue("id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// RestoreListing gestisce POST /api/v1/admin/listings/{id}/restore.
func (h *Handler) RestoreListing(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	if err := h.svc.RestoreListing(r.Context(), session.UserID, r.PathValue("id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
