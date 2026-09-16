package users

import (
	"net/http"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/httpx"
	"roomdate-backend/internal/validate"
)

// Handler espone le API legacy degli utenti, con percorsi e formati usati dal frontend attuale.
type Handler struct {
	svc      *Service
	sessions *auth.Manager
}

func NewHandler(svc *Service, sessions *auth.Manager) *Handler {
	return &Handler{svc: svc, sessions: sessions}
}

// loginRequest è il corpo di POST /api/login, che smista più azioni tramite il campo "action".
type loginRequest struct {
	Action   string `json:"action"`
	Email    string `json:"email"`
	Password string `json:"password"`
	ChangePasswordInput
}

type userData struct {
	ID       string `json:"id"`
	Nome     string `json:"nome"`
	Cognome  string `json:"cognome"`
	Email    string `json:"email"`
	UserType string `json:"user_type"`
}

func userDataFrom(a Account) userData {
	return userData{ID: a.ID, Nome: a.FirstName, Cognome: a.LastName, Email: a.Email, UserType: a.UserType}
}

type loginResponse struct {
	Message             string   `json:"message"`
	User                userData `json:"user"`
	EncryptedPrivateKey string   `json:"encryptedPrivateKey"`
	CryptoSalt          string   `json:"cryptoSalt"`
	CryptoIv            string   `json:"cryptoIv"`
	PublicKey           string   `json:"publicKey"`
}

// Login gestisce POST /api/login: accesso (azione predefinita), validate_session, logout,
// update_password e delete_account.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.WriteError(w, r, err)
		return
	}

	switch req.Action {
	case "validate_session":
		h.validateSession(w, r)
	case "logout":
		h.sessions.EndSession(w)
		httpx.Text(w, http.StatusOK, "Logout effettuato")
	case "update_password":
		h.updatePassword(w, r, req.ChangePasswordInput)
	case "delete_account":
		h.deleteAccount(w, r)
	default:
		h.login(w, r, req.Email, req.Password)
	}
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request, email, password string) {
	account, err := h.svc.Login(r.Context(), email, password)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.sessions.StartSession(w, account.ID, account.UserType); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, loginResponse{
		Message:             "Login effettuato con successo",
		User:                userDataFrom(account),
		EncryptedPrivateKey: account.Vault.EncryptedPrivateKey,
		CryptoSalt:          account.Vault.CryptoSalt,
		CryptoIv:            account.Vault.CryptoIV,
		PublicKey:           account.Vault.PublicKey,
	})
}

func (h *Handler) validateSession(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		httpx.WriteError(w, r, apperr.Unauthorized("session_invalid", "Sessione inesistente o scaduta"))
		return
	}
	account, err := h.svc.SessionAccount(r.Context(), session.UserID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, userDataFrom(account))
}

func (h *Handler) updatePassword(w http.ResponseWriter, r *http.Request, in ChangePasswordInput) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
		return
	}
	if err := h.svc.ChangePassword(r.Context(), session.UserID, in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Text(w, http.StatusOK, "Password aggiornata con successo")
}

func (h *Handler) deleteAccount(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		httpx.WriteError(w, r, errSessionInvalid)
		return
	}
	if err := h.svc.DeleteAccount(r.Context(), session.UserID); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	h.sessions.EndSession(w)
	httpx.Text(w, http.StatusOK, "Account eliminato")
}

// Register gestisce POST /api/register.
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
	httpx.JSON(w, http.StatusCreated, map[string]string{"status": "success", "userId": id})
}

// GetProfile gestisce GET /api/profile[?userId=]: senza userId restituisce il proprio profilo.
func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	session, _ := h.sessions.FromRequest(r)
	targetID := r.URL.Query().Get("userId")
	if targetID == "" {
		targetID = session.UserID
	}
	if targetID == "" {
		httpx.WriteError(w, r, apperr.Unauthorized("session_invalid", "Accesso negato: Sessione non valida o userId mancante"))
		return
	}
	if !validate.MaxLen(targetID, 64) {
		httpx.WriteError(w, r, errUserNotFound)
		return
	}

	profile, err := h.svc.Profile(r.Context(), session.UserID, targetID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, profile)
}

// UpdateProfile gestisce POST /api/profile.
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	session, ok := h.sessions.FromRequest(r)
	if !ok {
		httpx.WriteError(w, r, apperr.Unauthorized("session_invalid", "Accesso negato: Sessione non valida"))
		return
	}
	var in ProfileInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := h.svc.UpdateProfile(r.Context(), session.UserID, in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.Text(w, http.StatusOK, "Profilo aggiornato con successo")
}

// Roommates gestisce GET /api/get_roommates.
func (h *Handler) Roommates(w http.ResponseWriter, r *http.Request) {
	roommates, err := h.svc.Roommates(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, roommates)
}
