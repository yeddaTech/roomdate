package server_test

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"roomdate-backend/internal/config"
	"roomdate-backend/internal/realtime"
)

const realtimeAuthPath = "/api/v1/realtime/auth"

// Modulo M3.5: il server firma l'iscrizione solo al proprio canale utente e alle conversazioni di
// cui si fa parte. Senza una firma valida Pusher rifiuta l'iscrizione a un canale privato.
func TestRealtimeChannelAuthorization(t *testing.T) {
	f := newChatFixture(t)
	app := f.app
	const socket = "123456.7890123"
	authorize := func(cookie, channel string) *httptest.ResponseRecorder {
		return app.do(http.MethodPost, realtimeAuthPath,
			map[string]string{"socketId": socket, "channelName": channel}, withSession(cookie))
	}
	// La firma che Pusher ricalcola con il segreto quando il browser si iscrive
	signature := func(channel string) string {
		mac := hmac.New(sha256.New, []byte(testPusher.Secret))
		mac.Write([]byte(socket + ":" + channel))
		return testPusher.Key + ":" + hex.EncodeToString(mac.Sum(nil))
	}

	for channel, u := range map[string]user{
		realtime.UserChannel(f.anna.ID):             f.anna,
		realtime.UserChannel(f.marco.ID):            f.marco,
		realtime.ConversationChannel(f.directChat):  f.marco,
		realtime.ConversationChannel(f.listingChat): f.anna,
	} {
		rec := authorize(u.Cookie, channel)
		expect(t, rec, http.StatusOK, "")
		var got struct {
			Auth string `json:"auth"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || got.Auth != signature(channel) {
			t.Errorf("%s: risposta %s, attesa la firma %s", channel, rec.Body.String(), signature(channel))
		}
	}

	for name, c := range map[string]struct{ cookie, channel string }{
		"canale di un altro utente":   {f.carla.Cookie, realtime.UserChannel(f.anna.ID)},
		"ID utente con aggiunte":      {f.anna.Cookie, realtime.UserChannel(f.anna.ID) + "-altro"},
		"ID utente in maiuscolo":      {f.anna.Cookie, realtime.UserChannel(strings.ToUpper(f.anna.ID))},
		"conversazione altrui":        {f.carla.Cookie, realtime.ConversationChannel(f.directChat)},
		"conversazione inesistente":   {f.anna.Cookie, realtime.ConversationChannel(9999)},
		"ID conversazione non valido": {f.anna.Cookie, "private-conversation-abc"},
		"ID con zeri davanti":         {f.anna.Cookie, "private-conversation-0" + itoa(f.directChat)},
		"canale pubblico":             {f.anna.Cookie, "user-" + f.anna.ID},
		"canale di presenza":          {f.anna.Cookie, "presence-user-" + f.anna.ID},
		"canale cifrato":              {f.anna.Cookie, "private-encrypted-user-" + f.anna.ID},
		"nessun canale":               {f.anna.Cookie, ""},
	} {
		t.Run(name, func(t *testing.T) {
			expect(t, authorize(c.cookie, c.channel), http.StatusForbidden, "channel_forbidden")
		})
	}

	for _, bad := range []string{"", "abc", "1.2.3", "123.", "123456.789\n", "-1.2"} {
		rec := app.do(http.MethodPost, realtimeAuthPath,
			map[string]string{"socketId": bad, "channelName": realtime.UserChannel(f.anna.ID)}, withSession(f.anna.Cookie))
		expect(t, rec, http.StatusBadRequest, "invalid_socket")
	}

	body := map[string]string{"socketId": socket, "channelName": realtime.UserChannel(f.anna.ID)}
	expect(t, app.do(http.MethodPost, realtimeAuthPath, body), http.StatusUnauthorized, "")
	expect(t, app.do(http.MethodPost, realtimeAuthPath, body, withSession(f.anna.Cookie),
		withHeader("Origin", "https://evil.example")), http.StatusForbidden, "")
}

// Senza credenziali Pusher (sviluppo locale) l'autorizzazione risponde "non disponibile".
func TestRealtimeAuthorizationWithoutPusher(t *testing.T) {
	app := newAppWithConfig(t, newFakeStorage(), config.Config{SecretKey: "segreto-di-test", SecureCookies: true})
	u := app.registerUser("Anna", "cerca", true)
	rec := app.do(http.MethodPost, realtimeAuthPath,
		map[string]string{"socketId": "1.2", "channelName": realtime.UserChannel(u.ID)}, withSession(u.Cookie))
	expect(t, rec, http.StatusServiceUnavailable, "realtime_disabled")
}
