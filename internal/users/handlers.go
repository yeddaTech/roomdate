package users

import (
	"net/http"

	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/httpx"
)

// Handler espone le API degli utenti: /api/v1/auth, /api/v1/me, /api/v1/users
// e l'elenco legacy dei coinquilini.
type Handler struct {
	svc      *Service
	sessions *auth.Manager
}

func NewHandler(svc *Service, sessions *auth.Manager) *Handler {
	return &Handler{svc: svc, sessions: sessions}
}

// sessionUser è l'utente in sessione, così come lo vede il frontend.
type sessionUser struct {
	ID        string `json:"id"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	UserType  string `json:"userType"`
}

func sessionUserFrom(a Account) sessionUser {
	return sessionUser{ID: a.ID, FirstName: a.FirstName, LastName: a.LastName, Email: a.Email, UserType: a.UserType}
}

// requireSession restituisce la sessione o risponde 401.
func (h *Handler) requireSession(w http.ResponseWriter, r *http.Request) (auth.Session, bool) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
	}
	return session, ok
}

// Session gestisce GET /api/v1/auth/session: {"user": {...}} oppure {"user": null} se non c'è
// una sessione valida. Un cookie scaduto o di un utente eliminato viene cancellato.
func (h *Handler) Session(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		if _, err := r.Cookie(auth.CookieName); err == nil {
			h.sessions.EndSession(w)
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"user": nil})
		return
	}

	account, found, err := h.svc.SessionAccount(r.Context(), session.UserID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if !found {
		h.sessions.EndSession(w)
		httpx.JSON(w, http.StatusOK, map[string]any{"user": nil})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"user": sessionUserFrom(account)})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	User sessionUser `json:"user"`
	// Keys è null per gli account senza chiavi di cifratura.
	Keys *Vault `json:"keys"`
}

// Login gestisce POST /api/v1/auth/login.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	account, err := h.svc.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.sessions.StartSession(w, account.ID); err != nil {
		httpx.WriteError(w, r, err)
		return
	}

	response := loginResponse{User: sessionUserFrom(account)}
	if account.Vault.EncryptedPrivateKey != "" {
		response.Keys = &account.Vault
	}
	httpx.JSON(w, http.StatusOK, response)
}

// Logout gestisce POST /api/v1/auth/logout.
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	h.sessions.EndSession(w)
	w.WriteHeader(http.StatusNoContent)
}

// Register gestisce POST /api/v1/auth/register.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var in RegisterInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	id, err := h.svc.Register(r.Context(), in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]string{"id": id})
}

// ChangePassword gestisce POST /api/v1/auth/password.
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	var in ChangePasswordInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.svc.ChangePassword(r.Context(), session.UserID, in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// MyProfile gestisce GET /api/v1/me.
func (h *Handler) MyProfile(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	profile, err := h.svc.MyProfile(r.Context(), session.UserID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, profile)
}

// UpdateMyProfile gestisce PUT /api/v1/me e restituisce il profilo aggiornato.
func (h *Handler) UpdateMyProfile(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	var in ProfileInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	profile, err := h.svc.UpdateProfile(r.Context(), session.UserID, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, profile)
}

// DeleteMe gestisce DELETE /api/v1/me.
func (h *Handler) DeleteMe(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	if err := h.svc.DeleteAccount(r.Context(), session.UserID); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	h.sessions.EndSession(w)
	w.WriteHeader(http.StatusNoContent)
}

// PublicProfile gestisce GET /api/v1/users/{id}.
func (h *Handler) PublicProfile(w http.ResponseWriter, r *http.Request) {
	session, _ := h.sessions.FromRequest(r)
	profile, err := h.svc.PublicProfile(r.Context(), session.UserID, r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, profile)
}

// Roommates gestisce GET /api/get_roommates (API legacy: diventa /api/v1/roommates nel modulo M1.5).
func (h *Handler) Roommates(w http.ResponseWriter, r *http.Request) {
	roommates, err := h.svc.Roommates(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, roommates)
}
