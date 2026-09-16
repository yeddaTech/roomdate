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
	"roomdate-backend/internal/realtime"
	"roomdate-backend/internal/users"
)

// Dimensione massima del corpo di una richiesta: la registrazione con le chiavi E2EE pesa circa 3 KB.
const maxBodyBytes = 64 << 10

type Deps struct {
	Config    config.Config
	DB        *pgxpool.Pool
	Publisher realtime.Publisher
	Logger    *slog.Logger
}

// New costruisce l'handler HTTP con tutte le rotte /api e i middleware comuni.
func New(d Deps) (http.Handler, error) {
	sessions, err := auth.NewManager(d.Config.JWTSecret, d.Config.SecureCookies)
	if err != nil {
		return nil, err
	}
	crossOrigin, err := httpx.CrossOriginProtection(d.Config.TrustedOrigins)
	if err != nil {
		return nil, err
	}

	usersHandler := users.NewHandler(users.NewService(users.NewStore(d.DB)), sessions)
	listingsHandler := listings.NewHandler(listings.NewService(listings.NewStore(d.DB)), sessions)
	chatHandler := chat.NewHandler(chat.NewService(chat.NewStore(d.DB), d.Publisher), sessions)

	type methods = map[string]http.HandlerFunc
	mux := http.NewServeMux()

	// API v1: JSON in camelCase, errori {"error": {"code", "message", "fields"}}.
	mux.Handle("/api/v1/auth/session", httpx.Methods(methods{http.MethodGet: usersHandler.Session}))
	mux.Handle("/api/v1/auth/login", httpx.Methods(methods{http.MethodPost: usersHandler.Login}))
	mux.Handle("/api/v1/auth/logout", httpx.Methods(methods{http.MethodPost: usersHandler.Logout}))
	mux.Handle("/api/v1/auth/register", httpx.Methods(methods{http.MethodPost: usersHandler.Register}))
	mux.Handle("/api/v1/auth/password", httpx.Methods(methods{http.MethodPost: usersHandler.ChangePassword}))
	mux.Handle("/api/v1/me", httpx.Methods(methods{
		http.MethodGet: usersHandler.MyProfile, http.MethodPut: usersHandler.UpdateMyProfile, http.MethodDelete: usersHandler.DeleteMe,
	}))
	mux.Handle("/api/v1/users/{id}", httpx.Methods(methods{http.MethodGet: usersHandler.PublicProfile}))
	mux.Handle("/api/v1/health", httpx.Methods(methods{http.MethodGet: health(d.DB).ServeHTTP}))

	// API legacy, con percorsi e formati originali: passano a /api/v1 nei moduli successivi
	// (annunci in M1.4, coinquilini in M1.5, chat in M1.7).
	mux.Handle("/api/get_roommates", httpx.Methods(methods{http.MethodGet: usersHandler.Roommates}))
	mux.Handle("/api/create_listing", httpx.Methods(methods{http.MethodPost: listingsHandler.Create}))
	mux.Handle("/api/get_listings", httpx.Methods(methods{http.MethodGet: listingsHandler.Latest}))
	mux.Handle("/api/get_listing", httpx.Methods(methods{http.MethodGet: listingsHandler.Get}))
	mux.Handle("/api/get_my_listings", httpx.Methods(methods{http.MethodGet: listingsHandler.Mine}))
	mux.Handle("/api/delete_listing", httpx.Methods(methods{http.MethodDelete: listingsHandler.Delete}))
	mux.Handle("/api/start_chat", httpx.Methods(methods{http.MethodPost: chatHandler.StartChat}))
	mux.Handle("/api/get_chats", httpx.Methods(methods{http.MethodGet: chatHandler.Conversations}))
	mux.Handle("/api/send_message", httpx.Methods(methods{http.MethodPost: chatHandler.SendMessage}))
	mux.Handle("/api/typing", httpx.Methods(methods{http.MethodPost: chatHandler.Typing}))

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
