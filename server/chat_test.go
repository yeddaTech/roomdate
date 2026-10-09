package server_test

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
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

// ivCounter rende diverso l'IV di ogni messaggio, come fa il browser (casuale per ogni messaggio):
// due invii con lo stesso testo e lo stesso IV sarebbero lo stesso messaggio inviato di nuovo.
var ivCounter atomic.Int64

// message costruisce un messaggio cifrato: un testo e una chiave per ogni partecipante.
func message(text string, recipients ...user) map[string]any {
	keys := []map[string]string{}
	for _, r := range recipients {
		keys = append(keys, map[string]string{"userId": r.ID, "key": b64("chiave-per-" + r.ID)})
	}
	return map[string]any{"body": b64(text), "iv": b64(fmt.Sprintf("%012d", ivCounter.Add(1))), "keys": keys}
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
		ID        int
		Title     string
		City      string
		Price     int
		CoverURL  *string
		Mine      bool
		Available bool
	}
	ListingDeleted bool
	Other          *struct {
		ID             string
		FirstName      string
		PublicKey      string
		Unavailable    bool
		ProfileVisible bool
	}
	LastMessage *chatMessage
	Blocked     *string
	UnreadCount int
	LastReadAt  *time.Time
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

// conversation è la conversazione indicata, come la vede chi ha il cookie.
func (a *testApp) conversation(cookie string, id int) conversationItem {
	a.t.Helper()
	for _, c := range a.conversations(cookie) {
		if c.ID == id {
			return c
		}
	}
	a.t.Fatalf("conversazione %d non trovata", id)
	return conversationItem{}
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

// Il badge della chat conta le conversazioni con messaggi da leggere, non i singoli messaggi.
func TestUnreadConversationsBadge(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	badge := func(cookie string) int {
		t.Helper()
		rec := app.do(http.MethodGet, "/api/v1/me/unread", nil, withSession(cookie))
		expect(t, rec, http.StatusOK, "")
		var body struct{ Conversations int }
		decode(t, rec, &body)
		return body.Conversations
	}
	if n := badge(f.anna.Cookie); n != 0 {
		t.Fatalf("senza messaggi il badge vale %d", n)
	}
	app.send(f.marco.Cookie, f.directChat, message("uno", f.anna, f.marco))
	app.send(f.marco.Cookie, f.directChat, message("due", f.anna, f.marco))
	app.send(f.marco.Cookie, f.listingChat, message("tre", f.anna, f.marco))
	if n := badge(f.anna.Cookie); n != 2 {
		t.Errorf("due conversazioni con messaggi nuovi: badge %d", n)
	}
	if n := badge(f.marco.Cookie); n != 0 {
		t.Errorf("i propri messaggi non contano: badge %d", n)
	}
	expect(t, app.do(http.MethodPost, "/api/v1/conversations/"+itoa(f.directChat)+"/read", nil, withSession(f.anna.Cookie)), http.StatusNoContent, "")
	if n := badge(f.anna.Cookie); n != 1 {
		t.Errorf("dopo aver letto una conversazione: badge %d", n)
	}
	// Un messaggio senza mittente (dati precedenti alla 00003) conta come nuovo, come nell'elenco delle chat
	if _, err := testPool.Exec(context.Background(), `
        INSERT INTO roomdate_app.messages (conversation_id, sender_id, content, sender_content, format, created_at)
        VALUES ($1, NULL, $2, $2, 1, NOW() + interval '1 second')`, f.directChat, b64("senza-mittente")); err != nil {
		t.Fatal(err)
	}
	if n := badge(f.anna.Cookie); n != 2 {
		t.Errorf("messaggio senza mittente dopo la lettura: badge %d", n)
	}
	if n := badge(f.carla.Cookie); n != 0 {
		t.Errorf("chi non partecipa non vede nulla: badge %d", n)
	}
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

// "Riprova" dopo una risposta persa rimanda lo stesso messaggio cifrato: il server restituisce
// quello già salvato invece di duplicarlo, e non avvisa di nuovo l'altro partecipante.
func TestSendMessageRetryIsNotDuplicated(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	path := func(id int) string { return "/api/v1/conversations/" + itoa(id) + "/messages" }
	payload := message("arrivo alle 18", f.anna, f.marco)

	first := app.send(f.anna.Cookie, f.directChat, payload)
	rec := app.do(http.MethodPost, path(f.directChat), payload, withSession(f.anna.Cookie))
	expect(t, rec, http.StatusOK, "")
	var again chatMessage
	decode(t, rec, &again)
	if again.ID != first.ID || !again.CreatedAt.Equal(first.CreatedAt) || again.Body != first.Body || again.Key != b64("chiave-per-"+f.anna.ID) {
		t.Fatalf("nuovo tentativo = %+v, primo invio = %+v", again, first)
	}
	if n := countMessages(t); n != 1 {
		t.Fatalf("messaggi dopo il nuovo tentativo = %d, atteso 1", n)
	}
	if events := app.publisher.recorded(); len(events) != 1 {
		t.Fatalf("Marco va avvisato una volta sola: %+v", events)
	}

	t.Run("lo stesso testo scritto di nuovo è un messaggio nuovo", func(t *testing.T) {
		if second := app.send(f.anna.Cookie, f.directChat, message("arrivo alle 18", f.anna, f.marco)); second.ID == first.ID {
			t.Fatal("un messaggio cifrato di nuovo (IV nuovo) non è un nuovo tentativo")
		}
	})

	t.Run("vale solo per lo stesso mittente e la stessa conversazione", func(t *testing.T) {
		before := countMessages(t)
		app.send(f.marco.Cookie, f.directChat, payload)
		app.send(f.anna.Cookie, f.listingChat, payload)
		if n := countMessages(t); n != before+2 {
			t.Fatalf("messaggi = %d, attesi %d", n, before+2)
		}
	})

	t.Run("tentativi contemporanei salvano un solo messaggio", func(t *testing.T) {
		before := countMessages(t)
		concurrent := message("ci sei?", f.anna, f.marco)
		const attempts = 8
		codes := make([]int, attempts)
		ids := make([]int, attempts)
		var wg sync.WaitGroup
		for i := range attempts {
			wg.Add(1)
			go func() {
				defer wg.Done()
				rec := app.do(http.MethodPost, path(f.directChat), concurrent, withSession(f.anna.Cookie))
				codes[i] = rec.Code
				var saved chatMessage
				if rec.Code < 300 {
					decode(t, rec, &saved)
				}
				ids[i] = saved.ID
			}()
		}
		wg.Wait()
		created := 0
		for i := range attempts {
			if codes[i] == http.StatusCreated {
				created++
			} else if codes[i] != http.StatusOK {
				t.Fatalf("tentativo %d: stato %d", i, codes[i])
			}
			if ids[i] != ids[0] {
				t.Fatalf("ID diversi tra i tentativi: %v", ids)
			}
		}
		if created != 1 || countMessages(t) != before+1 {
			t.Fatalf("%d risposte 201, %d messaggi nuovi: attesi 1 e 1", created, countMessages(t)-before)
		}
	})

	t.Run("dopo un giorno lo stesso contenuto è un messaggio nuovo", func(t *testing.T) {
		if _, err := testPool.Exec(context.Background(),
			`UPDATE roomdate_app.messages SET created_at = NOW() - interval '25 hours' WHERE id = $1`, first.ID); err != nil {
			t.Fatal(err)
		}
		if late := app.send(f.anna.Cookie, f.directChat, payload); late.ID == first.ID {
			t.Fatal("un messaggio di ieri non va confuso con un nuovo tentativo")
		}
	})
}

// La scheda dell'annuncio in cima alla chat: foto, città, se è proprio e se l'altro lo vede ancora.
func TestConversationListingCard(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	ctx := context.Background()

	card := app.conversation(f.anna.Cookie, f.listingChat).Listing
	if card == nil || card.ID != f.listingID || card.City != "Milano" || card.Price != 650 || card.CoverURL != nil ||
		card.Mine || !card.Available {
		t.Fatalf("scheda vista da Anna = %+v", card)
	}
	if mine := app.conversation(f.marco.Cookie, f.listingChat).Listing; mine == nil || !mine.Mine || !mine.Available {
		t.Fatalf("scheda vista da Marco = %+v", mine)
	}
	if direct := app.conversation(f.anna.Cookie, f.directChat); direct.Listing != nil || direct.ListingDeleted {
		t.Fatalf("chat diretta = %+v", direct)
	}

	t.Run("la prima foto dell'annuncio", func(t *testing.T) {
		if _, err := testPool.Exec(ctx, `
            INSERT INTO roomdate_app.listing_images (listing_id, storage_key, position)
            VALUES ($1, 'annunci/seconda.jpg', 2), ($1, 'annunci/prima.jpg', 1)`, f.listingID); err != nil {
			t.Fatal(err)
		}
		card := app.conversation(f.anna.Cookie, f.listingChat).Listing
		if card.CoverURL == nil || *card.CoverURL != "https://img.test/annunci/prima.jpg" {
			t.Fatalf("foto = %v", card.CoverURL)
		}
	})

	t.Run("un annuncio disattivato non è più disponibile per l'altro", func(t *testing.T) {
		testPool.Exec(ctx, `UPDATE roomdate_app.listings SET is_active = false WHERE id = $1`, f.listingID)
		if card := app.conversation(f.anna.Cookie, f.listingChat).Listing; card == nil || card.Available || card.Title == "" {
			t.Fatalf("scheda di un annuncio disattivato = %+v", card)
		}
		// Il proprietario lo vede sempre, ed è avvisato che gli altri no
		if mine := app.conversation(f.marco.Cookie, f.listingChat).Listing; !mine.Mine || mine.Available {
			t.Fatalf("scheda del proprietario = %+v", mine)
		}
		testPool.Exec(ctx, `UPDATE roomdate_app.listings SET is_active = true WHERE id = $1`, f.listingID)
	})

	t.Run("rimosso dalla moderazione o con il proprietario sospeso", func(t *testing.T) {
		testPool.Exec(ctx, `UPDATE roomdate_app.listings SET removed_at = NOW() WHERE id = $1`, f.listingID)
		if app.conversation(f.anna.Cookie, f.listingChat).Listing.Available {
			t.Fatal("annuncio rimosso ancora disponibile")
		}
		testPool.Exec(ctx, `UPDATE roomdate_app.listings SET removed_at = NULL WHERE id = $1`, f.listingID)
		testPool.Exec(ctx, `UPDATE roomdate_app.users SET suspended_at = NOW() WHERE id = $1`, f.marco.ID)
		if app.conversation(f.anna.Cookie, f.listingChat).Listing.Available {
			t.Fatal("annuncio di un account sospeso ancora disponibile")
		}
		testPool.Exec(ctx, `UPDATE roomdate_app.users SET suspended_at = NULL WHERE id = $1`, f.marco.ID)
	})

	t.Run("con un blocco l'annuncio sparisce", func(t *testing.T) {
		expect(t, app.block(f.anna.Cookie, f.marco.ID), http.StatusNoContent, "")
		if app.conversation(f.marco.Cookie, f.listingChat).Listing.Available {
			t.Fatal("dopo il blocco l'annuncio non è più disponibile")
		}
		expect(t, app.do(http.MethodDelete, "/api/v1/me/blocks/"+f.marco.ID, nil, withSession(f.anna.Cookie)), http.StatusNoContent, "")
		if !app.conversation(f.anna.Cookie, f.listingChat).Listing.Available {
			t.Fatal("dopo lo sblocco l'annuncio torna disponibile")
		}
	})

	t.Run("annuncio eliminato", func(t *testing.T) {
		expect(t, app.do(http.MethodDelete, "/api/v1/listings/"+itoa(f.listingID), nil, withSession(f.marco.Cookie)), http.StatusNoContent, "")
		for _, u := range []user{f.anna, f.marco} {
			if c := app.conversation(u.Cookie, f.listingChat); c.Listing != nil || !c.ListingDeleted {
				t.Fatalf("chat su un annuncio eliminato vista da %s = %+v", u.Email, c)
			}
		}
		if app.conversation(f.anna.Cookie, f.directChat).ListingDeleted {
			t.Fatal("la chat diretta non era su un annuncio")
		}
	})
}

// L'ultima lettura serve al separatore "Nuovi messaggi": i messaggi dell'altro arrivati dopo.
func TestConversationLastReadAt(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	if c := app.conversation(f.anna.Cookie, f.directChat); c.LastReadAt != nil {
		t.Fatalf("mai letta: lastReadAt = %v", c.LastReadAt)
	}
	before := time.Now().Add(-time.Minute)
	expect(t, app.do(http.MethodPost, "/api/v1/conversations/"+itoa(f.directChat)+"/read", nil, withSession(f.anna.Cookie)), http.StatusNoContent, "")
	read := app.conversation(f.anna.Cookie, f.directChat).LastReadAt
	if read == nil || read.Before(before) || read.After(time.Now().Add(time.Minute)) {
		t.Fatalf("lastReadAt dopo la lettura = %v", read)
	}
	if c := app.conversation(f.marco.Cookie, f.directChat); c.LastReadAt != nil {
		t.Fatalf("la lettura di Anna non vale per Marco: %v", c.LastReadAt)
	}
	newer := app.send(f.marco.Cookie, f.directChat, message("dopo", f.anna, f.marco))
	if !newer.CreatedAt.After(*read) {
		t.Fatalf("il messaggio nuovo (%v) va dopo l'ultima lettura (%v)", newer.CreatedAt, *read)
	}
}

// Una conversazione si legge anche da sola, come nell'elenco: la chat aperta da un indirizzo.
func TestSingleConversation(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	ctx := context.Background()
	app.send(f.marco.Cookie, f.listingChat, message("ciao Anna", f.anna, f.marco))
	path := func(id string) string { return "/api/v1/conversations/" + id }
	get := func(cookie string, id int) conversationItem {
		t.Helper()
		rec := app.do(http.MethodGet, path(itoa(id)), nil, withSession(cookie))
		expect(t, rec, http.StatusOK, "")
		var c conversationItem
		decode(t, rec, &c)
		return c
	}

	for _, id := range []int{f.directChat, f.listingChat} {
		if single, listed := get(f.anna.Cookie, id), app.conversation(f.anna.Cookie, id); !reflect.DeepEqual(single, listed) {
			t.Fatalf("conversazione %d da sola = %+v, nell'elenco = %+v", id, single, listed)
		}
	}
	if c := get(f.anna.Cookie, f.listingChat); c.UnreadCount != 1 || c.Other == nil || c.Other.FirstName != "Marco" || !c.Other.ProfileVisible {
		t.Fatalf("chat sull'annuncio = %+v %+v", c, c.Other)
	}

	expect(t, app.do(http.MethodGet, path(itoa(f.directChat)), nil), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodGet, path(itoa(f.directChat)), nil, withSession(f.carla.Cookie)), http.StatusForbidden, "not_participant")
	expect(t, app.do(http.MethodGet, path("99999"), nil, withSession(f.anna.Cookie)), http.StatusForbidden, "not_participant")
	expect(t, app.do(http.MethodGet, path("abc"), nil, withSession(f.anna.Cookie)), http.StatusBadRequest, "invalid_conversation")

	t.Run("il profilo dell'altro si apre solo se è visibile", func(t *testing.T) {
		visible := func() bool { return get(f.anna.Cookie, f.directChat).Other.ProfileVisible }
		testPool.Exec(ctx, `UPDATE roomdate_app.users SET is_public = false WHERE id = $1`, f.marco.ID)
		if visible() {
			t.Error("profilo privato")
		}
		testPool.Exec(ctx, `UPDATE roomdate_app.users SET is_public = true, suspended_at = NOW() WHERE id = $1`, f.marco.ID)
		if visible() {
			t.Error("account sospeso")
		}
		testPool.Exec(ctx, `UPDATE roomdate_app.users SET suspended_at = NULL WHERE id = $1`, f.marco.ID)
		expect(t, app.block(f.marco.Cookie, f.anna.ID), http.StatusNoContent, "")
		if visible() {
			t.Error("bloccata da Marco")
		}
		expect(t, app.do(http.MethodDelete, "/api/v1/me/blocks/"+f.anna.ID, nil, withSession(f.marco.Cookie)), http.StatusNoContent, "")
		if !visible() {
			t.Error("dopo lo sblocco il profilo torna visibile")
		}
	})
}
