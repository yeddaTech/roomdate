package server_test

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"roomdate-backend/internal/realtime"
)

func itoa(n int) string {
	return strconv.Itoa(n)
}

type chatFixture struct {
	app                     *testApp
	anna, marco, carla      user
	directChat, listingChat int
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

	var started struct{ ConversationID int }
	rec := app.do(http.MethodPost, "/api/start_chat", map[string]string{"targetId": f.marco.ID}, withSession(f.anna.Cookie))
	expect(t, rec, http.StatusOK, "")
	decode(t, rec, &started)
	f.directChat = started.ConversationID

	listingID := app.createListing(f.marco.Cookie, nil)
	rec = app.do(http.MethodPost, "/api/start_chat", map[string]int{"listingId": listingID}, withSession(f.anna.Cookie))
	expect(t, rec, http.StatusOK, "")
	decode(t, rec, &started)
	f.listingChat = started.ConversationID

	if f.directChat == 0 || f.listingChat == 0 || f.directChat == f.listingChat {
		t.Fatalf("conversazioni = %d, %d", f.directChat, f.listingChat)
	}
	return f
}

func message(conversationID int, text string) map[string]any {
	return map[string]any{"conversationId": conversationID, "text": b64(text + "-per-destinatario"), "senderText": b64(text + "-per-mittente")}
}

func countMessages(t *testing.T) int {
	var n int
	if err := testPool.QueryRow(context.Background(), `SELECT count(*) FROM roomdate_app.messages`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestStartChat(t *testing.T) {
	f := newChatFixture(t)
	app := f.app

	t.Run("la stessa coppia riusa la conversazione", func(t *testing.T) {
		rec := app.do(http.MethodPost, "/api/start_chat", map[string]string{"targetId": f.anna.ID}, withSession(f.marco.Cookie))
		expect(t, rec, http.StatusOK, `"conversationId":`+itoa(f.directChat))
		rec = app.do(http.MethodPost, "/api/start_chat", map[string]int{"listingId": 1}, withSession(f.anna.Cookie))
		expect(t, rec, http.StatusOK, `"conversationId":`+itoa(f.listingChat))
	})

	t.Run("niente conversazioni con sé stessi", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/start_chat", map[string]int{"listingId": 1}, withSession(f.marco.Cookie)), http.StatusBadRequest, "con te stesso")
		expect(t, app.do(http.MethodPost, "/api/start_chat", map[string]string{"targetId": f.anna.ID}, withSession(f.anna.Cookie)), http.StatusBadRequest, "con te stesso")
		expect(t, app.do(http.MethodPost, "/api/start_chat", map[string]string{"targetId": strings.ToUpper(f.anna.ID)}, withSession(f.anna.Cookie)), http.StatusBadRequest, "con te stesso")
	})

	t.Run("richieste non valide", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/start_chat", map[string]string{"targetId": f.marco.ID}), http.StatusUnauthorized, "")
		expect(t, app.do(http.MethodPost, "/api/start_chat", map[string]string{}, withSession(f.anna.Cookie)), http.StatusBadRequest, "Manca ListingID o TargetID")
		expect(t, app.do(http.MethodPost, "/api/start_chat", map[string]int{"listingId": 999}, withSession(f.anna.Cookie)), http.StatusNotFound, "Annuncio non trovato")
		expect(t, app.do(http.MethodPost, "/api/start_chat", map[string]string{"targetId": "999"}, withSession(f.anna.Cookie)), http.StatusNotFound, "Utente non trovato")
		rec := app.do(http.MethodPost, "/api/start_chat", map[string]string{"targetId": "abc"}, withSession(f.anna.Cookie))
		expect(t, rec, http.StatusNotFound, "Utente non trovato")
		expectNoLeak(t, rec)
	})
}

func TestSendMessageAuthorization(t *testing.T) {
	f := newChatFixture(t)
	app := f.app

	expect(t, app.do(http.MethodPost, "/api/send_message", message(f.directChat, "x")), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodPost, "/api/send_message", message(f.directChat, "intruso"), withSession(f.carla.Cookie)), http.StatusForbidden, "")
	expect(t, app.do(http.MethodPost, "/api/send_message", message(f.listingChat, "intruso"), withSession(f.carla.Cookie)), http.StatusForbidden, "")
	expect(t, app.do(http.MethodPost, "/api/send_message", message(99999, "intruso"), withSession(f.carla.Cookie)), http.StatusForbidden, "")
	expect(t, app.do(http.MethodPost, "/api/send_message", message(0, "x"), withSession(f.anna.Cookie)), http.StatusBadRequest, "")
	expect(t, app.do(http.MethodPost, "/api/send_message", map[string]any{"conversationId": f.directChat, "text": "", "senderText": "y"}, withSession(f.anna.Cookie)), http.StatusBadRequest, "Messaggio non valido")
	if n := countMessages(t); n != 0 {
		t.Fatalf("messaggi salvati da richieste non valide: %d", n)
	}

	expect(t, app.do(http.MethodPost, "/api/send_message", message(f.directChat, "ciao"), withSession(f.anna.Cookie)), http.StatusOK, `"status":"ok"`)
	expect(t, app.do(http.MethodPost, "/api/send_message", message(f.directChat, "risposta"), withSession(f.marco.Cookie)), http.StatusOK, "")
	expect(t, app.do(http.MethodPost, "/api/send_message", message(f.listingChat, "dal proprietario"), withSession(f.marco.Cookie)), http.StatusOK, "")
	if n := countMessages(t); n != 3 {
		t.Fatalf("messaggi = %d, attesi 3", n)
	}

	events := app.publisher.recorded()
	if len(events) != 3 || events[0].Name != realtime.EventNewMessage {
		t.Fatalf("eventi = %+v", events)
	}
}

func TestSendMessageSurvivesRealtimeFailure(t *testing.T) {
	f := newChatFixture(t)
	f.app.publisher.fail = true

	rec := f.app.do(http.MethodPost, "/api/send_message", message(f.directChat, "ciao"), withSession(f.anna.Cookie))
	expect(t, rec, http.StatusOK, "")
	if countMessages(t) != 1 {
		t.Fatal("il messaggio va salvato anche se la notifica in tempo reale fallisce")
	}

	rec = f.app.do(http.MethodPost, "/api/typing", map[string]string{"conversationId": itoa(f.directChat)}, withSession(f.anna.Cookie))
	expect(t, rec, http.StatusInternalServerError, "Errore di trasmissione in tempo reale")
	if strings.Contains(rec.Body.String(), "dettaglio interno") {
		t.Fatalf("corpo = %q", rec.Body.String())
	}
}

func TestTypingAuthorization(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	convID := itoa(f.directChat)

	expect(t, app.do(http.MethodPost, "/api/typing", map[string]string{"conversationId": convID}, withHeader("Origin", "https://evil.example")), http.StatusForbidden, "")
	expect(t, app.do(http.MethodPost, "/api/typing", map[string]string{"conversationId": convID}), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodPost, "/api/typing", map[string]string{"conversationId": convID}, withSession(f.carla.Cookie)), http.StatusForbidden, "")
	expect(t, app.do(http.MethodPost, "/api/typing", map[string]string{"conversationId": "abc"}, withSession(f.anna.Cookie)), http.StatusBadRequest, "")
	if len(app.publisher.recorded()) != 0 {
		t.Fatal("nessun evento atteso dalle richieste rifiutate")
	}

	// Il mittente è quello della sessione, anche se il client ne indica un altro
	rec := app.do(http.MethodPost, "/api/typing", map[string]string{"conversationId": convID, "senderId": f.marco.ID}, withSession(f.anna.Cookie))
	expect(t, rec, http.StatusOK, "")
	events := app.publisher.recorded()
	if len(events) != 1 || events[0].Name != realtime.EventTyping {
		t.Fatalf("eventi = %+v", events)
	}
	data := events[0].Data.(map[string]string)
	if data["senderId"] != f.anna.ID || data["conversationId"] != convID {
		t.Fatalf("dati evento = %v", data)
	}
}

func TestConversations(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	expect(t, app.do(http.MethodPost, "/api/send_message", message(f.directChat, "ciao"), withSession(f.anna.Cookie)), http.StatusOK, "")
	expect(t, app.do(http.MethodPost, "/api/send_message", message(f.directChat, "risposta"), withSession(f.marco.Cookie)), http.StatusOK, "")

	type conversation struct {
		ID              int
		Name            string
		TargetPublicKey string
		Listing         struct{ Title string }
		Messages        []struct{ Type, Text, Time string }
	}
	read := func(cookie string) map[int]conversation {
		rec := app.do(http.MethodGet, "/api/get_chats", nil, withSession(cookie))
		expect(t, rec, http.StatusOK, "")
		var list []conversation
		decode(t, rec, &list)
		byID := map[int]conversation{}
		for _, c := range list {
			byID[c.ID] = c
		}
		return byID
	}

	annaChats := read(f.anna.Cookie)
	direct := annaChats[f.directChat]
	if len(annaChats) != 2 || direct.Name != "Marco" || direct.TargetPublicKey != b64("PUB-Marco") || direct.Listing.Title != "Chat Diretta" {
		t.Fatalf("chat di Anna = %+v", annaChats)
	}
	// Anna legge la propria copia dei messaggi inviati e la copia per il destinatario di quelli ricevuti
	if len(direct.Messages) != 2 ||
		direct.Messages[0].Type != "sent" || direct.Messages[0].Text != b64("ciao-per-mittente") ||
		direct.Messages[1].Type != "received" || direct.Messages[1].Text != b64("risposta-per-destinatario") {
		t.Fatalf("messaggi visti da Anna = %+v", direct.Messages)
	}
	if annaChats[f.listingChat].Name != "Marco" || annaChats[f.listingChat].Listing.Title != "Singola in zona Isola" {
		t.Fatalf("chat sull'annuncio vista da Anna = %+v", annaChats[f.listingChat])
	}

	marcoChats := read(f.marco.Cookie)
	if marcoChats[f.directChat].Name != "Anna" || marcoChats[f.directChat].Messages[0].Type != "received" ||
		marcoChats[f.listingChat].Name != "Anna" {
		t.Fatalf("chat di Marco = %+v", marcoChats)
	}

	if len(read(f.carla.Cookie)) != 0 {
		t.Fatal("Carla non partecipa a nessuna chat")
	}
	expect(t, app.do(http.MethodGet, "/api/get_chats", nil), http.StatusUnauthorized, "")
}
