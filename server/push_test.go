package server_test

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"roomdate-backend/internal/config"
	"roomdate-backend/internal/webpush"
	"roomdate-backend/server"
)

// fakePush registra le notifiche invece di mandarle ai servizi push.
type fakePush struct {
	mu   sync.Mutex
	sent []sentPush
	gone map[string]bool
}

type sentPush struct {
	Endpoint string
	Msg      webpush.Message
}

func (f *fakePush) PublicKey() string { return "BChiavePubblicaVapidDiProva" }

// Le stesse regole del mittente vero: solo i servizi push conosciuti
func (f *fakePush) Endpoints() webpush.Endpoints { return webpush.Endpoints{} }

func (f *fakePush) Send(_ context.Context, sub webpush.Subscription, msg webpush.Message) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, sentPush{Endpoint: sub.Endpoint, Msg: msg})
	if f.gone[sub.Endpoint] {
		return webpush.ErrGone
	}
	return nil
}

// take restituisce le notifiche inviate da quando è stato chiamato l'ultima volta.
func (f *fakePush) take() []sentPush {
	f.mu.Lock()
	defer f.mu.Unlock()
	sent := f.sent
	f.sent = nil
	return sent
}

func newPushApp(t *testing.T) (*testApp, *fakePush) {
	t.Helper()
	fake := &fakePush{gone: map[string]bool{}}
	cfg := config.Config{SecretKey: "segreto-di-test", SecureCookies: true, Pusher: testPusher}
	app := newAppWithPool(t, newFakeStorage(), cfg, appPool, func(d *server.Deps) { d.Push = fake })
	return app, fake
}

var subscriptionCounter int

// browserSubscription è un'iscrizione come la crea il browser, con un indirizzo di FCM.
func browserSubscription(t *testing.T) map[string]any {
	t.Helper()
	key, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	secret := make([]byte, 16)
	_, _ = rand.Read(secret)
	subscriptionCounter++
	return map[string]any{
		"endpoint": fmt.Sprintf("https://fcm.googleapis.com/fcm/send/dispositivo-%d", subscriptionCounter),
		"keys": map[string]string{
			"p256dh": base64.RawURLEncoding.EncodeToString(key.PublicKey().Bytes()),
			"auth":   base64.RawURLEncoding.EncodeToString(secret),
		},
	}
}

func (a *testApp) subscribe(cookie string, sub map[string]any) {
	a.t.Helper()
	expect(a.t, a.do(http.MethodPut, "/api/v1/me/push-subscriptions", sub, withSession(cookie)), http.StatusNoContent, "")
}

// subscriptionOwner restituisce chi ha l'iscrizione con quell'indirizzo ("" se non c'è).
func subscriptionOwner(t *testing.T, endpoint string) (userID, sessionID string) {
	t.Helper()
	_ = testPool.QueryRow(context.Background(), `SELECT user_id::text, session_id::text FROM roomdate_app.push_subscriptions WHERE endpoint = $1`, endpoint).Scan(&userID, &sessionID)
	return userID, sessionID
}

func TestPushUnavailableWithoutKeys(t *testing.T) {
	app := newApp(t)
	anna := app.registerUser("Anna", "cerca", true)
	expect(t, app.do(http.MethodGet, "/api/v1/push/key", nil), http.StatusServiceUnavailable, "push_unavailable")
	expect(t, app.do(http.MethodPut, "/api/v1/me/push-subscriptions", browserSubscription(t), withSession(anna.Cookie)), http.StatusServiceUnavailable, "push_unavailable")
}

func TestPushSubscriptions(t *testing.T) {
	app, _ := newPushApp(t)
	anna := app.registerUser("Anna", "cerca", true)
	marco := app.registerUser("Marco", "affitta", true)
	carla := app.registerUser("Carla", "cerca", true)

	expect(t, app.do(http.MethodGet, "/api/v1/push/key", nil), http.StatusOK, `"publicKey":"BChiavePubblicaVapidDiProva"`)

	t.Run("dati non validi", func(t *testing.T) {
		valid := browserSubscription(t)
		keys := valid["keys"].(map[string]string)
		for name, body := range map[string]any{
			"indirizzo di un altro sito":     map[string]any{"endpoint": "https://evil.example/push", "keys": keys},
			"indirizzo interno":              map[string]any{"endpoint": "https://169.254.169.254/latest", "keys": keys},
			"senza https":                    map[string]any{"endpoint": "http://fcm.googleapis.com/fcm/send/x", "keys": keys},
			"chiave non sulla curva":         map[string]any{"endpoint": valid["endpoint"], "keys": map[string]string{"p256dh": base64.RawURLEncoding.EncodeToString(make([]byte, 65)), "auth": keys["auth"]}},
			"segreto della lunghezza errata": map[string]any{"endpoint": valid["endpoint"], "keys": map[string]string{"p256dh": keys["p256dh"], "auth": "YWJj"}},
			"senza chiavi":                   map[string]any{"endpoint": valid["endpoint"]},
		} {
			rec := app.do(http.MethodPut, "/api/v1/me/push-subscriptions", body, withSession(anna.Cookie))
			if rec.Code != http.StatusBadRequest && rec.Code != http.StatusUnprocessableEntity {
				t.Errorf("%s: %d %s", name, rec.Code, rec.Body.String())
			}
		}
		expect(t, app.do(http.MethodPut, "/api/v1/me/push-subscriptions", "{", withSession(anna.Cookie), withHeader("Content-Type", "application/json")), http.StatusBadRequest, "invalid_json")
		var n int
		_ = testPool.QueryRow(context.Background(), `SELECT count(*) FROM roomdate_app.push_subscriptions`).Scan(&n)
		if n != 0 {
			t.Errorf("iscrizioni salvate: %d", n)
		}
	})

	t.Run("iscrizione legata alla sessione", func(t *testing.T) {
		sub := browserSubscription(t)
		app.subscribe(anna.Cookie, sub)
		user, session := subscriptionOwner(t, sub["endpoint"].(string))
		if user != anna.ID || session != sessionIDOf(t, anna.ID) {
			t.Errorf("iscrizione di %s, sessione %s", user, session)
		}
		// Lo stesso browser, un altro account: l'iscrizione passa a Marco
		app.subscribe(marco.Cookie, sub)
		if user, _ := subscriptionOwner(t, sub["endpoint"].(string)); user != marco.ID {
			t.Errorf("dopo l'accesso di Marco l'iscrizione è di %s", user)
		}
		// Carla non può togliere l'iscrizione di Marco; Marco sì
		expect(t, app.do(http.MethodDelete, "/api/v1/me/push-subscriptions", map[string]any{"endpoint": sub["endpoint"]}, withSession(carla.Cookie)), http.StatusNoContent, "")
		if user, _ := subscriptionOwner(t, sub["endpoint"].(string)); user != marco.ID {
			t.Error("l'iscrizione di Marco è stata tolta da Carla")
		}
		expect(t, app.do(http.MethodDelete, "/api/v1/me/push-subscriptions", map[string]any{"endpoint": sub["endpoint"]}, withSession(marco.Cookie)), http.StatusNoContent, "")
		if user, _ := subscriptionOwner(t, sub["endpoint"].(string)); user != "" {
			t.Error("iscrizione non tolta")
		}
		expect(t, app.do(http.MethodDelete, "/api/v1/me/push-subscriptions", map[string]any{"endpoint": ""}, withSession(marco.Cookie)), http.StatusBadRequest, "")
	})

	t.Run("al massimo dieci browser per utente", func(t *testing.T) {
		var first string
		for i := 0; i < 11; i++ {
			sub := browserSubscription(t)
			if i == 0 {
				first = sub["endpoint"].(string)
			}
			app.subscribe(carla.Cookie, sub)
		}
		var n int
		_ = testPool.QueryRow(context.Background(), `SELECT count(*) FROM roomdate_app.push_subscriptions WHERE user_id = $1`, carla.ID).Scan(&n)
		if user, _ := subscriptionOwner(t, first); n != 10 || user != "" {
			t.Errorf("iscrizioni di Carla: %d, la più vecchia ancora presente: %v", n, user != "")
		}
	})
}

func TestPushOnNewMessage(t *testing.T) {
	app, fake := newPushApp(t)
	anna := app.registerUser("Anna", "cerca", true)
	marco := app.registerUser("Marco", "affitta", true)
	chat := app.startChat(anna.Cookie, map[string]any{"targetId": marco.ID})
	phone, laptop, marcosPhone := browserSubscription(t), browserSubscription(t), browserSubscription(t)
	app.subscribe(anna.Cookie, phone)
	app.subscribe(anna.Cookie, laptop)
	app.subscribe(marco.Cookie, marcosPhone)
	fake.take()

	t.Run("i browser di chi riceve, non quelli di chi scrive", func(t *testing.T) {
		body := message("Ciao Anna", anna, marco)
		app.send(marco.Cookie, chat, body)
		sent := fake.take()
		if len(sent) != 2 {
			t.Fatalf("notifiche: %+v", sent)
		}
		got := map[string]bool{}
		for _, s := range sent {
			got[s.Endpoint] = true
			var payload map[string]any
			if err := json.Unmarshal(s.Msg.Payload, &payload); err != nil {
				t.Fatal(err)
			}
			want := map[string]any{"type": "message", "conversationId": float64(chat), "from": "Marco"}
			for k, v := range want {
				if payload[k] != v {
					t.Errorf("%s = %v, atteso %v", k, payload[k], v)
				}
			}
			if len(payload) != 3 {
				t.Errorf("la notifica contiene altro oltre a tipo, conversazione e nome: %v", payload)
			}
			if s.Msg.TTL != 12*time.Hour || s.Msg.Urgency != "high" || s.Msg.Topic != fmt.Sprintf("conv-%d", chat) {
				t.Errorf("opzioni %+v", s.Msg)
			}
		}
		if !got[phone["endpoint"].(string)] || !got[laptop["endpoint"].(string)] {
			t.Errorf("destinatari %v", got)
		}

		// Lo stesso messaggio inviato di nuovo (rete instabile): nessuna notifica in più
		expect(t, app.do(http.MethodPost, "/api/v1/conversations/"+itoa(chat)+"/messages", body, withSession(marco.Cookie)), http.StatusOK, "")
		if sent := fake.take(); len(sent) != 0 {
			t.Errorf("notifiche per un messaggio ripetuto: %d", len(sent))
		}
	})

	t.Run("un'iscrizione scaduta si cancella", func(t *testing.T) {
		fake.gone[laptop["endpoint"].(string)] = true
		app.send(marco.Cookie, chat, message("Ci sei?", anna, marco))
		fake.take()
		if user, _ := subscriptionOwner(t, laptop["endpoint"].(string)); user != "" {
			t.Error("l'iscrizione scaduta è rimasta")
		}
		if user, _ := subscriptionOwner(t, phone["endpoint"].(string)); user != anna.ID {
			t.Error("cancellata anche l'iscrizione valida")
		}
	})

	t.Run("sessione inattiva da più di una settimana: niente notifiche", func(t *testing.T) {
		_, _ = testPool.Exec(context.Background(), `UPDATE roomdate_app.sessions SET last_used_at = now() - interval '8 days' WHERE user_id = $1`, anna.ID)
		app.send(marco.Cookie, chat, message("Sei ancora interessata?", anna, marco))
		if sent := fake.take(); len(sent) != 0 {
			t.Errorf("notifiche a una sessione inattiva: %d", len(sent))
		}
		_, _ = testPool.Exec(context.Background(), `UPDATE roomdate_app.sessions SET last_used_at = now() WHERE user_id = $1`, anna.ID)
	})

	t.Run("uscendo, il browser non riceve più notifiche", func(t *testing.T) {
		expect(t, app.do(http.MethodPost, "/api/v1/auth/logout", nil, withSession(anna.Cookie)), http.StatusNoContent, "")
		if user, _ := subscriptionOwner(t, phone["endpoint"].(string)); user != "" {
			t.Error("iscrizione rimasta dopo l'uscita")
		}
		app.send(marco.Cookie, chat, message("Ti scrivo dopo", anna, marco))
		if sent := fake.take(); len(sent) != 0 {
			t.Errorf("notifiche dopo l'uscita: %d", len(sent))
		}
	})

	t.Run("chiudendo la sessione da un altro dispositivo", func(t *testing.T) {
		laptopCookie := app.login(anna.Email, anna.Password)
		phoneCookie := app.login(anna.Email, anna.Password)
		sub := browserSubscription(t)
		app.subscribe(phoneCookie, sub)
		_, phoneSession := subscriptionOwner(t, sub["endpoint"].(string))
		expect(t, app.do(http.MethodDelete, "/api/v1/me/sessions/"+phoneSession, nil, withSession(laptopCookie)), http.StatusNoContent, "")
		if user, _ := subscriptionOwner(t, sub["endpoint"].(string)); user != "" {
			t.Error("iscrizione rimasta dopo la chiusura della sessione")
		}
	})
}
