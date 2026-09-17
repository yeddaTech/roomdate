package listings

import (
	"net/http"

	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/httpx"
)

// Handler espone le API v1 degli annunci.
type Handler struct {
	svc      *Service
	sessions *auth.Manager
}

func NewHandler(svc *Service, sessions *auth.Manager) *Handler {
	return &Handler{svc: svc, sessions: sessions}
}

func (h *Handler) requireSession(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	session, ok := h.sessions.FromRequest(r.Context(), r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
	}
	return session, ok
}

// List gestisce GET /api/v1/listings?city=&maxPrice=&roomType=&billsIncluded=&sort=&cursor=&limit=.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page, err := h.svc.List(r.Context(), ListParams{
		City:          query.Get("city"),
		MaxPrice:      query.Get("maxPrice"),
		RoomType:      query.Get("roomType"),
		BillsIncluded: query.Get("billsIncluded"),
		Sort:          query.Get("sort"),
		Cursor:        query.Get("cursor"),
		Limit:         query.Get("limit"),
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, page)
}

// Mine gestisce GET /api/v1/me/listings.
func (h *Handler) Mine(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	listings, err := h.svc.Mine(r.Context(), session.UserID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, listings)
}

// Get gestisce GET /api/v1/listings/{id}.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	session, _ := h.sessions.FromRequest(r.Context(), r)
	detail, err := h.svc.Get(r.Context(), session.UserID, r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, detail)
}

// Create gestisce POST /api/v1/listings.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	var in Input
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	detail, err := h.svc.Create(r.Context(), session.UserID, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, detail)
}

// Update gestisce PUT /api/v1/listings/{id}.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	var in Input
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	detail, err := h.svc.Update(r.Context(), session.UserID, r.PathValue("id"), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, detail)
}

// SetActive gestisce PUT /api/v1/listings/{id}/active con {"active": true|false}.
func (h *Handler) SetActive(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	var in struct {
		Active *bool `json:"active"`
	}
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if in.Active == nil {
		httpx.WriteError(w, r, errMissingActive)
		return
	}
	if err := h.svc.SetActive(r.Context(), session.UserID, r.PathValue("id"), *in.Active); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Delete gestisce DELETE /api/v1/listings/{id}.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	if err := h.svc.Delete(r.Context(), session.UserID, r.PathValue("id")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PrepareUpload gestisce POST /api/v1/listings/{id}/images/uploads.
func (h *Handler) PrepareUpload(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	var in UploadInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	upload, err := h.svc.PrepareUpload(r.Context(), session.UserID, r.PathValue("id"), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, upload)
}

// ConfirmUpload gestisce POST /api/v1/listings/{id}/images.
func (h *Handler) ConfirmUpload(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	var in ConfirmInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	image, err := h.svc.ConfirmUpload(r.Context(), session.UserID, r.PathValue("id"), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, image)
}

// DeleteImage gestisce DELETE /api/v1/listings/{id}/images/{imageId}.
func (h *Handler) DeleteImage(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	if err := h.svc.DeleteImage(r.Context(), session.UserID, r.PathValue("id"), r.PathValue("imageId")); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
