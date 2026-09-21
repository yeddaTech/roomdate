package chat

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/httpx"
	"roomdate-backend/internal/realtime"
	"roomdate-backend/internal/validate"
)

// Autorizzazione dei canali privati in tempo reale (modulo M3.5). pusher-js chiede una firma prima
// di iscriversi a un canale "private-": il server la rilascia solo per il canale dell'utente stesso
// e per quelli delle conversazioni di cui fa parte. Senza firma Pusher rifiuta l'iscrizione.

var (
	errInvalidSocket    = apperr.BadRequest("invalid_socket", "Connessione in tempo reale non valida")
	errChannelForbidden = apperr.Forbidden("channel_forbidden", "Accesso negato a questo canale")
	errRealtimeDisabled = apperr.New(http.StatusServiceUnavailable, "realtime_disabled", "Tempo reale non disponibile")
)

// Formato degli ID di connessione assegnati da Pusher, es. "123456.7890123".
var socketIDPattern = regexp.MustCompile(`\A\d+\.\d+\z`)

// RealtimeAuthInput è la richiesta di pusher-js: la connessione e il canale da aprire.
type RealtimeAuthInput struct {
	SocketID    string `json:"socketId"`
	ChannelName string `json:"channelName"`
}

// AuthorizeChannel restituisce la firma per iscrivere la connessione al canale, se l'utente
// ne ha diritto.
func (s *Service) AuthorizeChannel(ctx context.Context, userID string, in RealtimeAuthInput) (string, error) {
	if !socketIDPattern.MatchString(in.SocketID) {
		return "", errInvalidSocket
	}
	if err := s.requireChannelAccess(ctx, userID, in.ChannelName); err != nil {
		return "", err
	}
	signature, err := s.authorizer.Authorize(in.SocketID, in.ChannelName)
	if errors.Is(err, realtime.ErrDisabled) {
		return "", errRealtimeDisabled
	}
	return signature, err
}

func (s *Service) requireChannelAccess(ctx context.Context, userID, channel string) error {
	if id, ok := strings.CutPrefix(channel, realtime.UserChannelPrefix); ok {
		if id != userID {
			return errChannelForbidden
		}
		return nil
	}
	if raw, ok := strings.CutPrefix(channel, realtime.ConversationChannelPrefix); ok {
		conversationID, ok := validate.PositiveID(raw)
		// Solo la forma esatta del nome ("…-7", non "…-07"): una conversazione, un canale
		if !ok || realtime.ConversationChannel(conversationID) != channel {
			return errChannelForbidden
		}
		participant, err := s.store.IsParticipant(ctx, conversationID, userID)
		if err != nil {
			return fmt.Errorf("verifica partecipante: %w", err)
		}
		if !participant {
			return errChannelForbidden
		}
		return nil
	}
	return errChannelForbidden
}

// AuthorizeRealtime gestisce POST /api/v1/realtime/auth con {"socketId", "channelName"}.
// Risponde {"auth": "..."}, il formato che pusher-js si aspetta.
func (h *Handler) AuthorizeRealtime(w http.ResponseWriter, r *http.Request) {
	session, ok := h.requireSession(w, r)
	if !ok {
		return
	}
	var in RealtimeAuthInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	signature, err := h.svc.AuthorizeChannel(r.Context(), session.UserID, in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"auth": signature})
}
