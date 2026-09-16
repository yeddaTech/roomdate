// Package handler è la funzione serverless di Vercel: vercel.json inoltra qui tutte le richieste /api/*,
// gestite dall'applicazione in internal/server.
package handler

import (
	"net/http"
	"sync"

	"roomdate-backend/internal/server"
)

var (
	appOnce sync.Once
	app     http.Handler
)

// Handler è l'unica funzione che Vercel espone ed esegue.
// L'applicazione (configurazione e pool di connessioni) viene creata alla prima richiesta
// e riusata finché l'istanza resta attiva.
func Handler(w http.ResponseWriter, r *http.Request) {
	appOnce.Do(func() {
		app = server.FromEnv()
	})
	app.ServeHTTP(w, r)
}
