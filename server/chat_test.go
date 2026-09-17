package server_test

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"roomdate-backend/internal/realtime"
)

func itoa(n int) string {
	return strconv.Itoa(n)
}

type chatFixture struct {
	app                     *testApp
	anna, marco, carla      user
	directChat, listingChat int
	listingID               int
}

// newChatFixture crea una chat diretta Anna↔Marco e una chat di Anna sull'annuncio di Marco.
// Carla non partecipa a nessuna delle due.
func newChatFixture(t *testing.T) chatFixture {
	app := newApp(t)
	f := chatFixture{
		app:   app,
		anna:  app.registerUser("Anna", "cerca", true),
		marco: app.registerUser("Marco", "affitta", true),
		carla: app.registerUser("Carla", "cerca", true),
	}
	f.directChat = app.startChat(f.anna.Cookie, map[string]any{"targetId": f.marco.ID})
	f.listingID = app.createListing(f.marco.Cookie, nil)
	f.listingChat = app.startChat(f.anna.Cookie, map[string]any{"listingId": f.listingID})

	if f.directChat == 0 || f.listingChat == 0 || f.directChat == f.listingChat {
		t.Fatalf("conversazioni = %d, %d", f.directChat, f.listingChat)
	}
	return f
}

func (a *testApp) startChat(cookie string, target map[string]any) int {
	a.t.Helper()
	rec := a.do(http.MethodPost, "/api/v1/conversations", target, withSession(cookie))
	expect(a.t, rec, http.StatusOK, "")
	var started struct{ ID int }
	decode(a.t, rec, &started)
	return started.ID
}

// message costruisce un messaggio cifrato: un testo e una chiave per ogni partecipante.
func message(text string, recipients ...user) map[string]any {
	keys := []map[string]string{}
	for _, r := range recipients {
		keys = append(keys, map[string]string{"userId": r.ID, "key": b64("chiave-per-" + r.ID)})
	}
	return map[string]any{"body": b64(text), "iv": b64("123456789012"), "keys": keys}
}

type chatMessage struct {
	ID        int
	SenderID  string
	Format    int
	Body      string
	IV        string
	Key       string
	CreatedAt time.Time
}

type messagesPage struct {
	Items      []chatMessage
	NextCursor *string
}

type conversationItem struct {
	ID      int
	Listing *struct {
		ID    int
		Title string
		Price int
	}
	Other *struct {
		ID        string
		FirstName string
		PublicKey string
	}
	LastMessage *chatMessage
	UnreadCount int
	UpdatedAt   time.Time
}

func (a *testApp) send(cookie string, conversationID int, body map[string]any) *chatMessage {
	a.t.Helper()
	rec := a.do(http.MethodPost, "/api/v1/conversations/"+itoa(conversationID)+"/messages", body, withSession(cookie))
	expect(a.t, rec, http.StatusCreated, "")
	var saved chatMessage
	decode(a.t, rec, &saved)
	return &saved
}

func (a *testApp) messages(cookie string, conversationID int, query string) messagesPage {
	a.t.Helper()
	rec := a.do(http.MethodGet, "/api/v1/conversations/"+itoa(conversationID)+"/messages"+query, nil, withSession(cookie))
	expect(a.t, rec, http.StatusOK, "")
	var page messagesPage
	decode(a.t, rec, &page)
	return page
}

type conversationsPage struct {
	Items      []conversationItem
	NextCursor *string
}

func (a *testApp) conversationsPage(cookie, query string) conversationsPage {
	a.t.Helper()
	rec := a.do(http.MethodGet, "/api/v1/conversations"+query, nil, withSession(cookie))
	expect(a.t, rec, http.StatusOK, "")
	var page conversationsPage
	decode(a.t, rec, &page)
	return page
}

func (a *testApp) conversations(cookie string) []conversationItem {
	a.t.Helper()
	return a.conversationsPage(cookie, "").Items
}

func countMessages(t *testing.T) int {
	var n int
	if err := testPool.QueryRow(context.Background(), `SELECT count(*) FROM roomdate_app.messages`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// Anomalia F13: la stessa coppia, o lo stesso annuncio, hanno una sola conversazione.
func TestStartChat(t *testing.T) {
	f := newChatFixture(t)
	app := f.app

	t.Run("la stessa coppia riusa la conversazione", func(t *testing.T) {
		if id := app.startChat(f.marco.Cookie, map[string]any{"targetId": f.anna.ID}); id != f.directChat {
			t.Errorf("chat diretta = %d, attesa %d", id, f.directChat)
		}
		if id := app.startChat(f.anna.Cookie, map[string]any{"listingId": f.listingID}); id != f.listingChat {
			t.Errorf("chat sull'annuncio = %d, attesa %d", id, f.listingChat)
		}
		var n int
		testPool.QueryRow(context.Background(), `SELECT count(*) FROM roomdate_app.conversations`).Scan(&n)
		if n != 2 {
			t.Errorf("conversazioni nel database = %d, attese 2", n)
		}
	})

	t.Run("i partecipanti sono registrati", func(t *testing.T) {
		var participants []string
		rows, err := testPool.Query(context.Background(),
			`SELECT user_id::text FROM roomdate_app.conversation_participants WHERE conversation_id = $1 ORDER BY 1`, f.directChat)
		if err != nil {
			t.Fatal(err)
		}
		for rows.Next() {
			var id string
			rows.Scan(&id)
			participants = append(participants, id)
		}
		want := []string{f.anna.ID, f.marco.ID}
		slices.Sort(want)
		if !slices.Equal(participants, want) {
			t.Errorf("partecipanti = %v, attesi %v", participants, want)
		}
	})

	t.Run("niente conversazioni con sé stessi", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]int{"listingId": f.listingID}, withSession(f.marco.Cookie)), http.StatusBadRequest, "con te stesso")
		expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]string{"targetId": f.anna.ID}, withSession(f.anna.Cookie)), http.StatusBadRequest, "con te stesso")
		expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]string{"targetId": strings.ToUpper(f.anna.ID)}, withSession(f.anna.Cookie)), http.StatusBadRequest, "con te stesso")
	})

	t.Run("richieste non valide", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]string{"targetId": f.marco.ID}), http.StatusUnauthorized, "")
		expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]string{}, withSession(f.anna.Cookie)), http.StatusBadRequest, "Manca ListingID o TargetID")
		expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]int{"listingId": 999}, withSession(f.anna.Cookie)), http.StatusNotFound, "Annuncio non trovato")
		expect(t, app.do(http.MethodPost, "/api/v1/conversations", map[string]string{"targetId": "999"}, withSession(f.anna.Cookie)), http.StatusNotFound, "Utente non trovato")
		rec := app.do(http.MethodPost, "/api/v1/conversations", map[string]string{"targetId": "abc"}, withSession(f.anna.Cookie))
		expect(t, rec, http.StatusNotFound, "Utente non trovato")
		expectNoLeak(t, rec)
	})
}

func TestSendMessageAuthorization(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	valid := message("ciao", f.anna, f.marco)
	path := func(id int) string { return "/api/v1/conversations/" + itoa(id) + "/messages" }

	expect(t, app.do(http.MethodPost, path(f.directChat), valid), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodPost, path(f.directChat), valid, withSession(f.carla.Cookie)), http.StatusForbidden, "")
	expect(t, app.do(http.MethodPost, path(f.listingChat), valid, withSession(f.carla.Cookie)), http.StatusForbidden, "")
	expect(t, app.do(http.MethodPost, path(99999), valid, withSession(f.carla.Cookie)), http.StatusForbidden, "")
	expect(t, app.do(http.MethodPost, path(0), valid, withSession(f.anna.Cookie)), http.StatusBadRequest, "")

	t.Run("messaggi malformati", func(t *testing.T) {
		cases := map[string]map[string]any{
			"testo vuoto":            {"body": "", "iv": b64("123456789012"), "keys": message("x", f.anna, f.marco)["keys"]},
			"testo non base64":       {"body": "non-base64!", "iv": b64("123456789012"), "keys": message("x", f.anna, f.marco)["keys"]},
			"iv mancante":            {"body": b64("ciao"), "iv": "", "keys": message("x", f.anna, f.marco)["keys"]},
			"chiave di un altro":     message("ciao", f.anna, f.carla),
			"chiave in meno":         message("ciao", f.anna),
			"chiave in più":          message("ciao", f.anna, f.marco, f.carla),
			"chiave non base64":      {"body": b64("ciao"), "iv": b64("123456789012"), "keys": []map[string]string{{"userId": f.anna.ID, "key": "!"}, {"userId": f.marco.ID, "key": "!"}}},
			"nessuna chiave":         {"body": b64("ciao"), "iv": b64("123456789012"), "keys": []map[string]string{}},
			"messaggio troppo lungo": {"body": b64(strings.Repeat("a", 20000)), "iv": b64("123456789012"), "keys": message("x", f.anna, f.marco)["keys"]},
		}
		for name, body := range cases {
			rec := app.do(http.MethodPost, path(f.directChat), body, withSession(f.anna.Cookie))
			expect(t, rec, http.StatusBadRequest, "")
			if name == "chiave di un altro" || name == "chiave in meno" {
				expect(t, rec, http.StatusBadRequest, "keys_mismatch")
			}
		}
	})
	if n := countMessages(t); n != 0 {
		t.Fatalf("messaggi salvati da richieste non valide: %d", n)
	}

	app.send(f.anna.Cookie, f.directChat, message("ciao", f.anna, f.marco))
	app.send(f.marco.Cookie, f.directChat, message("risposta", f.anna, f.marco))
	app.send(f.marco.Cookie, f.listingChat, message("dal proprietario", f.anna, f.marco))
	if n := countMessages(t); n != 3 {
		t.Fatalf("messaggi = %d, attesi 3", n)
	}

	// Ogni messaggio avvisa solo l'altro partecipante, sul suo canale (anomalia F12)
	events := app.publisher.recorded()
	if len(events) != 3 || events[0].Name != realtime.EventNewMessage ||
		events[0].Channel != realtime.UserChannel(f.marco.ID) || events[1].Channel != realtime.UserChannel(f.anna.ID) {
		t.Fatalf("eventi = %+v", events)
	}
}

// Anomalia F8: con la cifratura ibrida un messaggio lungo non ha più il limite di RSA.
func TestLongMessage(t *testing.T) {
	f := newChatFixture(t)
	long := strings.Repeat("Questo è un messaggio lungo con accenti e emoji 🏠. ", 100)
	saved := f.app.send(f.anna.Cookie, f.directChat, message(long, f.anna, f.marco))

	if saved.Format != 2 || saved.Body != b64(long) {
		t.Fatalf("messaggio salvato = %+v", saved)
	}
	received := f.app.messages(f.marco.Cookie, f.directChat, "").Items
	if len(received) != 1 || received[0].Body != b64(long) || received[0].Key != b64("chiave-per-"+f.marco.ID) {
		t.Fatalf("messaggio ricevuto = %+v", received)
	}
}

func TestSendMessageSurvivesRealtimeFailure(t *testing.T) {
	f := newChatFixture(t)
	f.app.publisher.fail = true

	rec := f.app.do(http.MethodPost, "/api/v1/conversations/"+itoa(f.directChat)+"/messages",
		message("ciao", f.anna, f.marco), withSession(f.anna.Cookie))
	expect(t, rec, http.StatusCreated, "")
	if countMessages(t) != 1 {
		t.Fatal("il messaggio va salvato anche se la notifica in tempo reale fallisce")
	}

	rec = f.app.do(http.MethodPost, "/api/v1/conversations/"+itoa(f.directChat)+"/typing", nil, withSession(f.anna.Cookie))
	expect(t, rec, http.StatusInternalServerError, "Errore di trasmissione in tempo reale")
	if strings.Contains(rec.Body.String(), "dettaglio interno") {
		t.Fatalf("corpo = %q", rec.Body.String())
	}
}

func TestTypingAuthorization(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	path := "/api/v1/conversations/" + itoa(f.directChat) + "/typing"

	expect(t, app.do(http.MethodPost, path, nil, withHeader("Origin", "https://evil.example")), http.StatusForbidden, "")
	expect(t, app.do(http.MethodPost, path, nil), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodPost, path, nil, withSession(f.carla.Cookie)), http.StatusForbidden, "")
	expect(t, app.do(http.MethodPost, "/api/v1/conversations/abc/typing", nil, withSession(f.anna.Cookie)), http.StatusBadRequest, "")
	if len(app.publisher.recorded()) != 0 {
		t.Fatal("nessun evento atteso dalle richieste rifiutate")
	}

	expect(t, app.do(http.MethodPost, path, nil, withSession(f.anna.Cookie)), http.StatusNoContent, "")
	events := app.publisher.recorded()
	if len(events) != 1 || events[0].Name != realtime.EventTyping || events[0].Channel != realtime.UserChannel(f.marco.ID) {
		t.Fatalf("eventi = %+v", events)
	}
	// Il mittente è quello della sessione, non uno indicato dal client
	if data := events[0].Data.(map[string]string); data["senderId"] != f.anna.ID || data["conversationId"] != itoa(f.directChat) {
		t.Fatalf("dati evento = %v", events[0].Data)
	}
}

func TestConversations(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	app.send(f.anna.Cookie, f.directChat, message("ciao", f.anna, f.marco))
	last := app.send(f.marco.Cookie, f.directChat, message("risposta", f.anna, f.marco))

	byID := func(cookie string) map[int]conversationItem {
		out := map[int]conversationItem{}
		for _, c := range app.conversations(cookie) {
			out[c.ID] = c
		}
		return out
	}

	annaChats := byID(f.anna.Cookie)
	direct := annaChats[f.directChat]
	if len(annaChats) != 2 || direct.Other == nil || direct.Other.FirstName != "Marco" ||
		direct.Other.PublicKey != b64("PUB-Marco") || direct.Listing != nil {
		t.Fatalf("chat diretta di Anna = %+v", direct)
	}
	// L'elenco porta con sé l'ultimo messaggio, già leggibile da chi guarda: niente richiesta per chat
	if direct.LastMessage == nil || direct.LastMessage.ID != last.ID || direct.LastMessage.Body != b64("risposta") ||
		direct.LastMessage.Key != b64("chiave-per-"+f.anna.ID) || direct.UnreadCount != 1 {
		t.Fatalf("ultimo messaggio visto da Anna = %+v (non letti %d)", direct.LastMessage, direct.UnreadCount)
	}
	listingChat := annaChats[f.listingChat]
	if listingChat.Listing == nil || listingChat.Listing.Title != "Singola in zona Isola" || listingChat.Listing.Price != 650 ||
		listingChat.LastMessage != nil || listingChat.UnreadCount != 0 {
		t.Fatalf("chat sull'annuncio vista da Anna = %+v", listingChat)
	}

	marcoChats := byID(f.marco.Cookie)
	if marcoChats[f.directChat].Other.FirstName != "Anna" || marcoChats[f.directChat].UnreadCount != 1 ||
		marcoChats[f.directChat].LastMessage.Key != b64("chiave-per-"+f.marco.ID) {
		t.Fatalf("chat di Marco = %+v", marcoChats[f.directChat])
	}

	// L'elenco è ordinato per ultimo messaggio, non per data di creazione della conversazione
	if list := app.conversations(f.anna.Cookie); list[0].ID != f.directChat || list[1].ID != f.listingChat {
		t.Fatalf("ordine = %+v", list)
	}
	app.send(f.marco.Cookie, f.listingChat, message("sull'annuncio", f.anna, f.marco))
	if list := app.conversations(f.anna.Cookie); list[0].ID != f.listingChat || list[1].ID != f.directChat {
		t.Fatalf("ordine dopo un messaggio nella chat più vecchia = %+v", list)
	}
	if len(app.conversations(f.carla.Cookie)) != 0 {
		t.Fatal("Carla non partecipa a nessuna chat")
	}
	expect(t, app.do(http.MethodGet, "/api/v1/conversations", nil), http.StatusUnauthorized, "")
}

// Aprire la conversazione azzera i non letti; i messaggi inviati non contano mai come non letti.
func TestUnreadCount(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	unread := func(cookie string, conversationID int) int {
		for _, c := range app.conversations(cookie) {
			if c.ID == conversationID {
				return c.UnreadCount
			}
		}
		t.Fatalf("conversazione %d non trovata", conversationID)
		return -1
	}

	for i := 0; i < 3; i++ {
		app.send(f.marco.Cookie, f.directChat, message(fmt.Sprintf("messaggio %d", i), f.anna, f.marco))
	}
	if got := unread(f.anna.Cookie, f.directChat); got != 3 {
		t.Errorf("non letti di Anna = %d, attesi 3", got)
	}
	if got := unread(f.marco.Cookie, f.directChat); got != 0 {
		t.Errorf("i propri messaggi non sono da leggere: %d", got)
	}

	expect(t, app.do(http.MethodPost, "/api/v1/conversations/"+itoa(f.directChat)+"/read", nil, withSession(f.anna.Cookie)), http.StatusNoContent, "")
	if got := unread(f.anna.Cookie, f.directChat); got != 0 {
		t.Errorf("non letti dopo l'apertura = %d", got)
	}

	app.send(f.marco.Cookie, f.directChat, message("nuovo", f.anna, f.marco))
	if got := unread(f.anna.Cookie, f.directChat); got != 1 {
		t.Errorf("non letti dopo un nuovo messaggio = %d", got)
	}
	expect(t, app.do(http.MethodPost, "/api/v1/conversations/"+itoa(f.directChat)+"/read", nil, withSession(f.carla.Cookie)), http.StatusForbidden, "")
}

// I messaggi arrivano a pagine, dal più recente: la chat non li carica più tutti insieme (anomalia F12).
func TestMessagesPagination(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	for i := 1; i <= 7; i++ {
		sender := f.anna
		cookie := f.anna.Cookie
		if i%2 == 0 {
			sender, cookie = f.marco, f.marco.Cookie
		}
		_ = sender
		app.send(cookie, f.directChat, message(fmt.Sprintf("messaggio %d", i), f.anna, f.marco))
	}

	var seen []string
	query := "?limit=2"
	pages := 0
	for {
		pages++
		if pages > 10 {
			t.Fatal("la paginazione non termina")
		}
		page := app.messages(f.anna.Cookie, f.directChat, query)
		for _, m := range page.Items {
			seen = append(seen, m.Body)
		}
		if page.NextCursor == nil {
			break
		}
		query = "?limit=2&cursor=" + url.QueryEscape(*page.NextCursor)
	}

	var want []string
	for i := 7; i >= 1; i-- {
		want = append(want, b64(fmt.Sprintf("messaggio %d", i)))
	}
	if !slices.Equal(seen, want) || pages != 4 {
		t.Fatalf("%d pagine, messaggi = %v", pages, seen)
	}

	expect(t, app.do(http.MethodGet, "/api/v1/conversations/"+itoa(f.directChat)+"/messages?limit=0", nil, withSession(f.anna.Cookie)), http.StatusBadRequest, `"field":"limit"`)
	expect(t, app.do(http.MethodGet, "/api/v1/conversations/"+itoa(f.directChat)+"/messages?cursor=abc", nil, withSession(f.anna.Cookie)), http.StatusBadRequest, `"field":"cursor"`)
	expect(t, app.do(http.MethodGet, "/api/v1/conversations/"+itoa(f.directChat)+"/messages", nil, withSession(f.carla.Cookie)), http.StatusForbidden, "")
}

// I messaggi scritti prima della cifratura ibrida restano leggibili (formato 1).
func TestLegacyMessagesStillReadable(t *testing.T) {
	f := newChatFixture(t)
	ctx := context.Background()
	_, err := testPool.Exec(ctx, `
        INSERT INTO roomdate_app.messages (conversation_id, sender_id, content, sender_content, format, created_at)
        VALUES ($1, $2, $3, $4, 1, NOW() - interval '1 hour')`,
		f.directChat, f.anna.ID, b64("vecchio-per-destinatario"), b64("vecchio-per-mittente"))
	if err != nil {
		t.Fatal(err)
	}
	f.app.send(f.marco.Cookie, f.directChat, message("nuovo", f.anna, f.marco))

	forAnna := f.app.messages(f.anna.Cookie, f.directChat, "").Items
	forMarco := f.app.messages(f.marco.Cookie, f.directChat, "").Items
	if len(forAnna) != 2 || forAnna[1].Format != 1 || forAnna[1].Body != b64("vecchio-per-mittente") || forAnna[1].Key != "" {
		t.Fatalf("messaggi di Anna = %+v", forAnna)
	}
	if forMarco[1].Format != 1 || forMarco[1].Body != b64("vecchio-per-destinatario") {
		t.Fatalf("messaggi di Marco = %+v", forMarco)
	}
	// Anche l'ultimo messaggio dell'elenco è quello nuovo, non il vecchio
	for _, c := range f.app.conversations(f.anna.Cookie) {
		if c.ID == f.directChat && (c.LastMessage == nil || c.LastMessage.Format != 2) {
			t.Fatalf("ultimo messaggio = %+v", c.LastMessage)
		}
	}
}

// Anche le conversazioni arrivano a pagine, dalla più attiva.
func TestConversationsPagination(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	dario := app.registerUser("Dario", "cerca", true)
	elena := app.registerUser("Elena", "cerca", true)
	third := app.startChat(f.anna.Cookie, map[string]any{"targetId": dario.ID})
	fourth := app.startChat(f.anna.Cookie, map[string]any{"targetId": elena.ID})

	// Ordine di attività: quarta, terza, annuncio, diretta
	app.send(f.anna.Cookie, f.directChat, message("prima", f.anna, f.marco))
	app.send(f.anna.Cookie, f.listingChat, message("poi", f.anna, f.marco))
	app.send(f.anna.Cookie, third, message("quindi", f.anna, dario))
	app.send(f.anna.Cookie, fourth, message("infine", f.anna, elena))
	want := []int{fourth, third, f.listingChat, f.directChat}

	var seen []int
	query := "?limit=2"
	pages := 0
	for {
		pages++
		if pages > 5 {
			t.Fatal("la paginazione non termina")
		}
		page := app.conversationsPage(f.anna.Cookie, query)
		for _, c := range page.Items {
			seen = append(seen, c.ID)
		}
		if page.NextCursor == nil {
			break
		}
		query = "?limit=2&cursor=" + url.QueryEscape(*page.NextCursor)
	}
	if !slices.Equal(seen, want) || pages != 2 {
		t.Fatalf("%d pagine, conversazioni = %v, attese %v", pages, seen, want)
	}

	expect(t, app.do(http.MethodGet, "/api/v1/conversations?limit=0", nil, withSession(f.anna.Cookie)), http.StatusBadRequest, `"field":"limit"`)
	expect(t, app.do(http.MethodGet, "/api/v1/conversations?cursor=abc", nil, withSession(f.anna.Cookie)), http.StatusBadRequest, `"field":"cursor"`)
}
