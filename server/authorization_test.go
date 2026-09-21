package server_test

import (
	"net/http"
	"os"
	"regexp"
	"slices"
	"sort"
	"strings"
	"testing"

	"roomdate-backend/internal/realtime"
)

// Modulo M3.3: per ogni endpoint, cosa succede senza sessione e quando un altro utente (Carla)
// prova a usare le risorse di Anna e Marco. Le rotte si leggono da server.go: un endpoint nuovo
// senza una riga in questa tabella fa fallire il test, così nessuno resta senza controlli.

type authCase struct {
	// path concreto, con gli ID delle risorse di Anna e Marco
	path string
	body any
	// anonymous è lo stato atteso senza sessione (0 = endpoint pubblico, non controllato qui)
	anonymous int
	// intruder è lo stato atteso per Carla, che non è né proprietaria né partecipante
	// (0 = l'endpoint riguarda solo chi lo chiama, non le risorse di altri)
	intruder int
}

func TestEveryEndpointChecksAccess(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	imageKey := app.uploadImage(f.marco.Cookie, f.listingID, "image/jpeg", jpegBytes(100))
	var imageID int
	testPool.QueryRow(t.Context(), `SELECT id FROM roomdate_app.listing_images WHERE storage_key = $1`, imageKey).Scan(&imageID)
	listing := "/api/v1/listings/" + itoa(f.listingID)
	chat := "/api/v1/conversations/" + itoa(f.directChat)
	message := message("intrusa", f.anna, f.marco)

	cases := map[string]authCase{
		"GET /api/v1/auth/session":            {path: "/api/v1/auth/session"},
		"POST /api/v1/auth/login":             {path: "/api/v1/auth/login"},
		"POST /api/v1/auth/logout":            {path: "/api/v1/auth/logout"},
		"POST /api/v1/auth/register":          {path: "/api/v1/auth/register"},
		"POST /api/v1/auth/prelogin":          {path: "/api/v1/auth/prelogin"},
		"POST /api/v1/auth/recovery/start":    {path: "/api/v1/auth/recovery/start"},
		"POST /api/v1/auth/recovery/verify":   {path: "/api/v1/auth/recovery/verify"},
		"POST /api/v1/auth/recovery/complete": {path: "/api/v1/auth/recovery/complete"},
		"GET /api/v1/health":                  {path: "/api/v1/health"},
		"GET /api/v1/roommates":               {path: "/api/v1/roommates"},
		"GET /api/v1/users/{id}":              {path: "/api/v1/users/" + f.anna.ID},
		"GET /api/v1/listings":                {path: "/api/v1/listings"},
		"GET /api/v1/listings/{id}":           {path: listing},

		"POST /api/v1/auth/password": {path: "/api/v1/auth/password", body: map[string]any{}, anonymous: 401},
		"POST /api/v1/auth/kdf":      {path: "/api/v1/auth/kdf", body: map[string]any{}, anonymous: 401},
		"PUT /api/v1/me/recovery":    {path: "/api/v1/me/recovery", body: map[string]any{}, anonymous: 401},
		"GET /api/v1/me":             {path: "/api/v1/me", anonymous: 401},
		"PUT /api/v1/me":             {path: "/api/v1/me", body: map[string]any{}, anonymous: 401},
		"DELETE /api/v1/me":          {path: "/api/v1/me", body: map[string]any{}, anonymous: 401},
		"GET /api/v1/me/listings":    {path: "/api/v1/me/listings", anonymous: 401},
		"GET /api/v1/me/sessions":    {path: "/api/v1/me/sessions", anonymous: 401},
		"DELETE /api/v1/me/sessions": {path: "/api/v1/me/sessions", anonymous: 401},
		// La sessione di un altro utente risulta inesistente
		"DELETE /api/v1/me/sessions/{id}": {path: "/api/v1/me/sessions/" + sessionIDOf(t, f.anna.ID), anonymous: 401, intruder: 404},
		"GET /api/v1/me/export":           {path: "/api/v1/me/export", anonymous: 401},
		"GET /api/v1/me/blocks":           {path: "/api/v1/me/blocks", anonymous: 401},
		"PUT /api/v1/me/blocks/{userId}":  {path: "/api/v1/me/blocks/" + f.anna.ID, anonymous: 401},
		// Sbloccare riguarda solo i propri blocchi: 204 anche se non ce n'era uno
		"DELETE /api/v1/me/blocks/{userId}": {path: "/api/v1/me/blocks/" + f.anna.ID, anonymous: 401},
		"POST /api/v1/reports":              {path: "/api/v1/reports", body: map[string]any{}, anonymous: 401},

		"POST /api/v1/listings":                         {path: "/api/v1/listings", body: validListing(), anonymous: 401},
		"PUT /api/v1/listings/{id}":                     {path: listing, body: validListing(), anonymous: 401, intruder: 403},
		"DELETE /api/v1/listings/{id}":                  {path: listing, anonymous: 401, intruder: 403},
		"PUT /api/v1/listings/{id}/active":              {path: listing + "/active", body: map[string]bool{"active": false}, anonymous: 401, intruder: 403},
		"POST /api/v1/listings/{id}/images/uploads":     {path: listing + "/images/uploads", body: map[string]string{"contentType": "image/jpeg"}, anonymous: 401, intruder: 403},
		"POST /api/v1/listings/{id}/images":             {path: listing + "/images", body: map[string]string{"key": "pending/x"}, anonymous: 401, intruder: 403},
		"DELETE /api/v1/listings/{id}/images/{imageId}": {path: listing + "/images/" + itoa(imageID), anonymous: 401, intruder: 403},

		"GET /api/v1/conversations":                {path: "/api/v1/conversations", anonymous: 401},
		"POST /api/v1/conversations":               {path: "/api/v1/conversations", body: map[string]any{"targetId": f.anna.ID}, anonymous: 401},
		"GET /api/v1/conversations/{id}/messages":  {path: chat + "/messages", anonymous: 401, intruder: 403},
		"POST /api/v1/conversations/{id}/messages": {path: chat + "/messages", body: message, anonymous: 401, intruder: 403},
		"POST /api/v1/conversations/{id}/read":     {path: chat + "/read", anonymous: 401, intruder: 403},
		"POST /api/v1/realtime/auth": {path: "/api/v1/realtime/auth", anonymous: 401, intruder: 403,
			body: map[string]string{"socketId": "1.2", "channelName": realtime.ConversationChannel(f.directChat)}},

		"GET /api/v1/admin/reports":                {path: "/api/v1/admin/reports", anonymous: 401, intruder: 403},
		"POST /api/v1/admin/reports/{id}/resolve":  {path: "/api/v1/admin/reports/1/resolve", body: map[string]string{"action": "dismiss"}, anonymous: 401, intruder: 403},
		"POST /api/v1/admin/users/{id}/unsuspend":  {path: "/api/v1/admin/users/" + f.anna.ID + "/unsuspend", anonymous: 401, intruder: 403},
		"POST /api/v1/admin/listings/{id}/restore": {path: "/api/v1/admin/listings/" + itoa(f.listingID) + "/restore", anonymous: 401, intruder: 403},
	}

	routes := registeredRoutes(t)
	for _, route := range routes {
		if _, ok := cases[route]; !ok {
			t.Errorf("manca il controllo degli accessi per %s: aggiungilo alla tabella", route)
		}
	}
	for route := range cases {
		if !slices.Contains(routes, route) {
			t.Errorf("%s è nella tabella ma non in server.go", route)
		}
	}

	for route, c := range cases {
		method := strings.Fields(route)[0]
		t.Run(route, func(t *testing.T) {
			if c.anonymous != 0 {
				if rec := app.do(method, c.path, c.body); rec.Code != c.anonymous {
					t.Errorf("senza sessione: %d, atteso %d (%s)", rec.Code, c.anonymous, rec.Body.String())
				}
			}
			if c.intruder != 0 {
				if rec := app.do(method, c.path, c.body, withSession(f.carla.Cookie)); rec.Code != c.intruder {
					t.Errorf("da un altro utente: %d, atteso %d (%s)", rec.Code, c.intruder, rec.Body.String())
				}
			}
		})
	}

	// Le risorse di Anna e Marco sono rimaste com'erano
	if detail, status := app.listing(f.listingID, f.marco.Cookie); status != http.StatusOK || !detail.IsActive || detail.Title != validListing()["title"] {
		t.Errorf("annuncio di Marco dopo i tentativi: %d %+v", status, detail)
	}
	if n := countMessages(t); n != 0 {
		t.Errorf("messaggi scritti da chi non partecipa: %d", n)
	}
	if app.session(f.anna.Cookie).User == nil {
		t.Error("la sessione di Anna non doveva essere chiusa")
	}
}

// registeredRoutes legge da server.go le rotte registrate, come "METODO /percorso".
func registeredRoutes(t *testing.T) []string {
	t.Helper()
	src, err := os.ReadFile("server.go")
	if err != nil {
		t.Fatal(err)
	}
	handle := regexp.MustCompile(`(?s)mux\.Handle\("([^"]+)", httpx\.Methods\(methods\{(.*?)\}\)\)`)
	method := regexp.MustCompile(`http\.Method(\w+):`)
	var routes []string
	for _, m := range handle.FindAllStringSubmatch(string(src), -1) {
		for _, verb := range method.FindAllStringSubmatch(m[2], -1) {
			routes = append(routes, strings.ToUpper(verb[1])+" "+m[1])
		}
	}
	if len(routes) < 40 {
		t.Fatalf("rotte lette da server.go: %d, il formato delle registrazioni è cambiato?", len(routes))
	}
	sort.Strings(routes)
	return routes
}

func sessionIDOf(t *testing.T, userID string) string {
	t.Helper()
	var id string
	if err := testPool.QueryRow(t.Context(), `SELECT id::text FROM roomdate_app.sessions WHERE user_id = $1 LIMIT 1`, userID).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}
