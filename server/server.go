// Package server compone l'applicazione: configurazione, database, servizi e rotte HTTP.
// Lo usano sia la funzione Vercel (api/index.go) sia il server di sviluppo (cmd/dev).
//
// Non sta in internal/ perché Vercel compila api/ come un pacchetto esterno al modulo, che non può
// importare pacchetti internal. Da qui in poi, invece, gli import verso internal/ sono consentiti.
package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"roomdate-backend/internal/apperr"
	"roomdate-backend/internal/auth"
	"roomdate-backend/internal/chat"
	"roomdate-backend/internal/config"
	"roomdate-backend/internal/db"
	"roomdate-backend/internal/httpx"
	"roomdate-backend/internal/listings"
	"roomdate-backend/internal/moderation"
	"roomdate-backend/internal/realtime"
	"roomdate-backend/internal/storage"
	"roomdate-backend/internal/users"
)

// Dimensione massima del corpo di una richiesta: la registrazione con le chiavi E2EE pesa circa 3 KB.
const maxBodyBytes = 64 << 10

type Deps struct {
	Config    config.Config
	DB        *pgxpool.Pool
	Publisher realtime.Publisher
	Logger    *slog.Logger
	// Storage delle foto; se nil viene creato da Config.Storage (disattivato se incompleto).
	Storage storage.Storage
}

// New costruisce l'handler HTTP con tutte le rotte /api e i middleware comuni.
func New(d Deps) (http.Handler, error) {
	security := auth.NewStore(d.DB)
	sessions, err := auth.NewManager(security, d.Config.SecretKey, d.Config.SecureCookies)
	if err != nil {
		return nil, err
	}
	crossOrigin, err := httpx.CrossOriginProtection(d.Config.TrustedOrigins)
	if err != nil {
		return nil, err
	}

	photos := d.Storage
	if photos == nil {
		photos = storage.New(d.Config.Storage)
	}
	deleteImages := func(ctx context.Context, keys []string) { listings.DeleteObjects(ctx, photos, keys) }

	mod := moderation.NewStore(d.DB)
	usersHandler := users.NewHandler(users.NewService(users.NewStore(d.DB), security, mod, sessions.Hash,
		users.Photos{Delete: deleteImages, URL: photos.PublicURL}), sessions)
	listingsHandler := listings.NewHandler(listings.NewService(listings.NewStore(d.DB), photos, mod), sessions)
	chatHandler := chat.NewHandler(chat.NewService(chat.NewStore(d.DB), d.Publisher, realtime.NewAuthorizer(d.Config.Pusher), mod), sessions)
	moderationHandler := moderation.NewHandler(moderation.NewService(mod), sessions)

	type methods = map[string]http.HandlerFunc
	mux := http.NewServeMux()

	// API v1: JSON in camelCase, errori {"error": {"code", "message", "fields"}}.
	mux.Handle("/api/v1/auth/session", httpx.Methods(methods{http.MethodGet: usersHandler.Session}))
	mux.Handle("/api/v1/auth/login", httpx.Methods(methods{http.MethodPost: usersHandler.Login}))
	mux.Handle("/api/v1/auth/logout", httpx.Methods(methods{http.MethodPost: usersHandler.Logout}))
	mux.Handle("/api/v1/auth/register", httpx.Methods(methods{http.MethodPost: usersHandler.Register}))
	mux.Handle("/api/v1/auth/password", httpx.Methods(methods{http.MethodPost: usersHandler.ChangePassword}))
	mux.Handle("/api/v1/auth/prelogin", httpx.Methods(methods{http.MethodPost: usersHandler.Prelogin}))
	mux.Handle("/api/v1/auth/kdf", httpx.Methods(methods{http.MethodPost: usersHandler.UpgradeKDF}))
	mux.Handle("/api/v1/auth/recovery/start", httpx.Methods(methods{http.MethodPost: usersHandler.RecoveryStart}))
	mux.Handle("/api/v1/auth/recovery/verify", httpx.Methods(methods{http.MethodPost: usersHandler.RecoveryVerify}))
	mux.Handle("/api/v1/auth/recovery/complete", httpx.Methods(methods{http.MethodPost: usersHandler.RecoveryComplete}))
	mux.Handle("/api/v1/me/recovery", httpx.Methods(methods{http.MethodPut: usersHandler.SetRecoveryKey}))
	mux.Handle("/api/v1/me", httpx.Methods(methods{
		http.MethodGet: usersHandler.MyProfile, http.MethodPut: usersHandler.UpdateMyProfile, http.MethodDelete: usersHandler.DeleteMe,
	}))
	mux.Handle("/api/v1/users/{id}", httpx.Methods(methods{http.MethodGet: usersHandler.PublicProfile}))
	mux.Handle("/api/v1/roommates", httpx.Methods(methods{http.MethodGet: usersHandler.Roommates}))
	mux.Handle("/api/v1/health", httpx.Methods(methods{http.MethodGet: health(d.DB).ServeHTTP}))

	mux.Handle("/api/v1/listings", httpx.Methods(methods{http.MethodGet: listingsHandler.List, http.MethodPost: listingsHandler.Create}))
	mux.Handle("/api/v1/listings/{id}", httpx.Methods(methods{
		http.MethodGet: listingsHandler.Get, http.MethodPut: listingsHandler.Update, http.MethodDelete: listingsHandler.Delete,
	}))
	mux.Handle("/api/v1/listings/{id}/active", httpx.Methods(methods{http.MethodPut: listingsHandler.SetActive}))
	mux.Handle("/api/v1/listings/{id}/images/uploads", httpx.Methods(methods{http.MethodPost: listingsHandler.PrepareUpload}))
	mux.Handle("/api/v1/listings/{id}/images", httpx.Methods(methods{http.MethodPost: listingsHandler.ConfirmUpload}))
	mux.Handle("/api/v1/listings/{id}/images/{imageId}", httpx.Methods(methods{http.MethodDelete: listingsHandler.DeleteImage}))
	mux.Handle("/api/v1/me/listings", httpx.Methods(methods{http.MethodGet: listingsHandler.Mine}))
	mux.Handle("/api/v1/me/sessions", httpx.Methods(methods{
		http.MethodGet: usersHandler.MySessions, http.MethodDelete: usersHandler.RevokeOtherSessions,
	}))
	mux.Handle("/api/v1/me/sessions/{id}", httpx.Methods(methods{http.MethodDelete: usersHandler.RevokeSession}))
	mux.Handle("/api/v1/me/export", httpx.Methods(methods{http.MethodGet: usersHandler.ExportMe}))

	// Blocchi, segnalazioni e moderazione (modulo M3.3)
	mux.Handle("/api/v1/me/blocks", httpx.Methods(methods{http.MethodGet: moderationHandler.Blocks}))
	mux.Handle("/api/v1/me/blocks/{userId}", httpx.Methods(methods{
		http.MethodPut: moderationHandler.Block, http.MethodDelete: moderationHandler.Unblock,
	}))
	mux.Handle("/api/v1/reports", httpx.Methods(methods{http.MethodPost: moderationHandler.Report}))
	mux.Handle("/api/v1/admin/reports", httpx.Methods(methods{http.MethodGet: moderationHandler.AdminReports}))
	mux.Handle("/api/v1/admin/reports/{id}/resolve", httpx.Methods(methods{http.MethodPost: moderationHandler.ResolveReport}))
	mux.Handle("/api/v1/admin/users/{id}/unsuspend", httpx.Methods(methods{http.MethodPost: moderationHandler.Unsuspend}))
	mux.Handle("/api/v1/admin/listings/{id}/restore", httpx.Methods(methods{http.MethodPost: moderationHandler.RestoreListing}))

	mux.Handle("/api/v1/conversations", httpx.Methods(methods{
		http.MethodGet: chatHandler.Conversations, http.MethodPost: chatHandler.StartChat,
	}))
	mux.Handle("/api/v1/conversations/{id}/messages", httpx.Methods(methods{
		http.MethodGet: chatHandler.Messages, http.MethodPost: chatHandler.SendMessage,
	}))
	mux.Handle("/api/v1/conversations/{id}/read", httpx.Methods(methods{http.MethodPost: chatHandler.MarkRead}))
	mux.Handle("/api/v1/me/unread", httpx.Methods(methods{http.MethodGet: chatHandler.Unread}))
	mux.Handle("/api/v1/realtime/auth", httpx.Methods(methods{http.MethodPost: chatHandler.AuthorizeRealtime}))

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteError(w, r, apperr.NotFound("endpoint_not_found", "Endpoint non trovato"))
	})

	return httpx.Chain(mux,
		httpx.RequestID(d.Logger),
		httpx.Logging(),
		httpx.Recover(),
		httpx.SecurityHeaders(),
		httpx.LimitBody(maxBodyBytes),
		crossOrigin,
		httpx.RequireJSON(),
	), nil
}

// health verifica che il database risponda.
func health(pool *pgxpool.Pool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			httpx.WriteError(w, r, &apperr.Error{
				Status: http.StatusServiceUnavailable, Code: "database_unavailable",
				Message: "Database non raggiungibile", Cause: err,
			})
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
}

// FromEnv costruisce l'applicazione dalle variabili d'ambiente (funzione Vercel).
// Se la configurazione non è valida, ogni richiesta riceve un errore 500 e il motivo finisce nei log.
func FromEnv() http.Handler {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.FromEnv()
	if err != nil {
		return misconfigured(logger, err)
	}
	pool, err := db.Open(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return misconfigured(logger, fmt.Errorf("connessione al database: %w", err))
	}
	handler, err := New(Deps{Config: cfg, DB: pool, Publisher: realtime.New(cfg.Pusher), Logger: logger})
	if err != nil {
		return misconfigured(logger, err)
	}
	return handler
}

func misconfigured(logger *slog.Logger, cause error) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger.Error("configurazione del server non valida", "err", cause)
		httpx.WriteError(w, r, apperr.New(http.StatusInternalServerError, "server_misconfigured", "Errore configurazione server"))
	})
}
