package users

import (
	"net/http"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/httpx"
)

// Handler espone le API degli utenti: /api/v1/auth, /api/v1/me, /api/v1/users e /api/v1/roommates.
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
	session, ok := h.sessions.FromRequest(r.Context(), r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
	}
	return session, ok
}

// Session gestisce GET /api/v1/auth/session: {"user": {...}} oppure {"user": null} se non c'è
// una sessione valida. Un cookie scaduto o di un utente eliminato viene cancellato.
func (h *Handler) Session(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r.Context(), r)
	if !ok {
		if _, err := r.Cookie(h.sessions.CookieName()); err == nil {
			h.sessions.ClearCookie(w)
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
		// L'account non esiste più: la sessione non serve a nulla
		if err := h.sessions.EndSession(r.Context(), w, session); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
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
	account, err := h.svc.Login(r.Context(), LoginInput{
		Email: req.Email, Password: req.Password, IPHash: h.sessions.IPHash(r),
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.sessions.StartSession(r.Context(), w, r, account.ID); err != nil {
		httpx.WriteError(w, r, err)
		return
	}

	response := loginResponse{User: sessionUserFrom(account)}
	if account.Vault.EncryptedPrivateKey != "" {
		response.Keys = &account.Vault
	}
	httpx.JSON(w, http.StatusOK, response)
}

// Logout gestisce POST /api/v1/auth/logout: revoca la sessione corrente.
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	session, _ := h.sessions.FromRequest(r.Context(), r)
	if err := h.sessions.EndSession(r.Context(), w, session); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
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
	// Cambiata la password, le sessioni aperte altrove non valgono più
	if _, err := h.sessions.RevokeOtherSessions(r.Context(), session.UserID, session.ID); err != nil {
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

// DeleteMe gestisce DELETE /api/v1/me con {"password": "..."}: l'eliminazione è definitiva,
// quindi la password va inserita di nuovo.
func (h *Handler) DeleteMe(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	var in struct {
		Password string `json:"password"`
	}
	// Una richiesta senza password (o malformata) vale come password sbagliata: risponde 401
	// come tutte le altre, senza distinguere il motivo.
	_ = httpx.DecodeJSON(r, &in)
	if err := h.svc.DeleteAccount(r.Context(), session.UserID, in.Password); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	// Le sessioni spariscono insieme all'account: basta cancellare il cookie
	h.sessions.ClearCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

// MySessions gestisce GET /api/v1/me/sessions: i dispositivi con l'accesso aperto.
func (h *Handler) MySessions(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	sessions, err := h.sessions.Sessions(r.Context(), session.UserID)
	if err != nil {
		httpx.WriteError(w, r, apperr.Wrap(err, "sessions_read_failed", "Impossibile leggere i dispositivi collegati"))
		return
	}

	type item struct {
		auth.StoredSession
		// Current indica la sessione da cui arriva questa richiesta.
		Current bool `json:"current"`
	}
	items := make([]item, 0, len(sessions))
	for _, s := range sessions {
		items = append(items, item{StoredSession: s, Current: s.ID == session.ID})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}

// RevokeSession gestisce DELETE /api/v1/me/sessions/{id}.
func (h *Handler) RevokeSession(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	revoked, err := h.sessions.RevokeSession(r.Context(), session.UserID, r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, r, apperr.Wrap(err, "session_revoke_failed", "Impossibile chiudere la sessione"))
		return
	}
	if !revoked {
		httpx.WriteError(w, r, apperr.NotFound("session_not_found", "Sessione non trovata"))
		return
	}
	if r.PathValue("id") == session.ID {
		h.sessions.ClearCookie(w)
	}
	w.WriteHeader(http.StatusNoContent)
}

// RevokeOtherSessions gestisce DELETE /api/v1/me/sessions: chiude gli accessi su tutti gli altri
// dispositivi e lascia aperto quello in uso.
func (h *Handler) RevokeOtherSessions(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	closed, err := h.sessions.RevokeOtherSessions(r.Context(), session.UserID, session.ID)
	if err != nil {
		httpx.WriteError(w, r, apperr.Wrap(err, "session_revoke_failed", "Impossibile chiudere le sessioni"))
		return
	}
	h.svc.RecordSessionsRevoked(r.Context(), session.UserID)
	httpx.JSON(w, http.StatusOK, map[string]int{"closed": closed})
}

// PublicProfile gestisce GET /api/v1/users/{id}.
func (h *Handler) PublicProfile(w http.ResponseWriter, r *http.Request) {
	session, _ := h.sessions.FromRequest(r.Context(), r)
	profile, err := h.svc.PublicProfile(r.Context(), session.UserID, r.PathValue("id"))
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, profile)
}

// Roommates gestisce GET /api/v1/roommates?city=&minBudget=&cursor=&limit=. La sessione è facoltativa:
// serve a escludere chi guarda e a indicare cosa ha in comune con ogni profilo.
func (h *Handler) Roommates(w http.ResponseWriter, r *http.Request) {
	session, _ := h.sessions.FromRequest(r.Context(), r)
	query := r.URL.Query()
	page, err := h.svc.Roommates(r.Context(), session.UserID, RoommatesParams{
		City: query.Get("city"), MinBudget: query.Get("minBudget"), Cursor: query.Get("cursor"), Limit: query.Get("limit"),
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, page)
}
