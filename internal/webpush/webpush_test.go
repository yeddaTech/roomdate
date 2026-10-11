package webpush

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func mustB64(t *testing.T, s string) []byte {
	t.Helper()
	b, err := b64.DecodeString(s)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

// L'esempio della RFC 8291 (sezione 5 e appendice A): con le stesse chiavi e lo stesso sale il
// messaggio cifrato deve essere identico, byte per byte.
func TestEncryptRFC8291Example(t *testing.T) {
	asPrivate, err := ecdh.P256().NewPrivateKey(mustB64(t, "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"))
	if err != nil {
		t.Fatal(err)
	}
	if got := b64.EncodeToString(asPrivate.PublicKey().Bytes()); got != "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8" {
		t.Fatalf("chiave pubblica del server = %s", got)
	}
	uaPublic := mustB64(t, "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4")
	authSecret := mustB64(t, "BTBZMqHH6r4Tts7J_aSIgg")
	salt := mustB64(t, "DGv6ra1nlYgDCS1FRnbzlw")
	got, err := encrypt([]byte("When I grow up, I want to be a watermelon"), uaPublic, authSecret, asPrivate, salt)
	if err != nil {
		t.Fatal(err)
	}
	want := "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
	if b64.EncodeToString(got) != want {
		t.Fatalf("messaggio cifrato diverso dalla RFC 8291:\n got %s\nwant %s", b64.EncodeToString(got), want)
	}
	plain, err := decrypt(got, mustB64(t, "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94"), authSecret)
	if err != nil || string(plain) != "When I grow up, I want to be a watermelon" {
		t.Fatalf("decifrato %q, %v", plain, err)
	}
}

// decrypt è la parte del browser (RFC 8291 e 8188): serve a verificare quello che cifra il server.
func decrypt(body, uaPrivateRaw, authSecret []byte) ([]byte, error) {
	if len(body) < 86 {
		return nil, errors.New("troppo corto")
	}
	salt, rs, idLen := body[:16], binary.BigEndian.Uint32(body[16:20]), int(body[20])
	asPublic := body[21 : 21+idLen]
	ciphertext := body[21+idLen:]
	if rs != recordSize || len(ciphertext) > int(rs) {
		return nil, errors.New("dimensione del record")
	}
	uaPrivate, err := ecdh.P256().NewPrivateKey(uaPrivateRaw)
	if err != nil {
		return nil, err
	}
	asKey, err := ecdh.P256().NewPublicKey(asPublic)
	if err != nil {
		return nil, err
	}
	secret, err := uaPrivate.ECDH(asKey)
	if err != nil {
		return nil, err
	}
	prkKey, _ := hkdf.Extract(sha256.New, secret, authSecret)
	ikm, _ := hkdf.Expand(sha256.New, prkKey, "WebPush: info\x00"+string(uaPrivate.PublicKey().Bytes())+string(asPublic), 32)
	prk, _ := hkdf.Extract(sha256.New, ikm, salt)
	cek, _ := hkdf.Expand(sha256.New, prk, "Content-Encoding: aes128gcm\x00", 16)
	nonce, _ := hkdf.Expand(sha256.New, prk, "Content-Encoding: nonce\x00", 12)
	block, _ := aes.NewCipher(cek)
	gcm, _ := cipher.NewGCM(block)
	record, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}
	end := strings.LastIndexByte(string(record), 0x02)
	if end < 0 || strings.Trim(string(record[end+1:]), "\x00") != "" {
		return nil, errors.New("delimitatore mancante")
	}
	return record[:end], nil
}

func TestEncryptLimits(t *testing.T) {
	ua, _ := ecdh.P256().GenerateKey(rand.Reader)
	auth := make([]byte, 16)
	if _, err := Encrypt(make([]byte, MaxPayload), ua.PublicKey().Bytes(), auth); err != nil {
		t.Errorf("contenuto della lunghezza massima: %v", err)
	}
	if _, err := Encrypt(make([]byte, MaxPayload+1), ua.PublicKey().Bytes(), auth); err == nil {
		t.Error("contenuto troppo lungo accettato")
	}
	if _, err := Encrypt([]byte("x"), []byte("non una chiave"), auth); err == nil {
		t.Error("chiave p256dh non valida accettata")
	}
	if _, err := Encrypt([]byte("x"), ua.PublicKey().Bytes(), auth[:8]); err == nil {
		t.Error("segreto auth corto accettato")
	}
	// Due cifrature dello stesso testo sono diverse (sale e chiave effimera nuovi)
	a, _ := Encrypt([]byte("ciao"), ua.PublicKey().Bytes(), auth)
	b, _ := Encrypt([]byte("ciao"), ua.PublicKey().Bytes(), auth)
	if string(a) == string(b) {
		t.Error("cifrature identiche")
	}
}

func TestVAPIDAuthorization(t *testing.T) {
	keys, err := GenerateKeys()
	if err != nil {
		t.Fatal(err)
	}
	again, err := ParsePrivateKey(keys.PrivateKey())
	if err != nil || again.PublicKey() != keys.PublicKey() {
		t.Fatalf("la chiave privata non si rilegge: %v", err)
	}
	if _, err := ParsePrivateKey("non-base64!"); err == nil {
		t.Error("chiave non valida accettata")
	}
	if _, err := ParsePrivateKey(b64.EncodeToString(make([]byte, 32))); err == nil {
		t.Error("chiave zero accettata")
	}

	endpoint, _ := url.Parse("https://fcm.googleapis.com/fcm/send/abc")
	now := time.Unix(1_800_000_000, 0)
	header, err := keys.authorization(endpoint, "https://roomdate.vercel.app", now)
	if err != nil {
		t.Fatal(err)
	}
	token, key, ok := strings.Cut(strings.TrimPrefix(header, "vapid t="), ", k=")
	if !ok || !strings.HasPrefix(header, "vapid t=") || key != keys.PublicKey() {
		t.Fatalf("header %q", header)
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("JWT %q", token)
	}
	var head, claims map[string]any
	_ = json.Unmarshal(mustB64(t, parts[0]), &head)
	_ = json.Unmarshal(mustB64(t, parts[1]), &claims)
	if head["alg"] != "ES256" || head["typ"] != "JWT" {
		t.Errorf("intestazione %v", head)
	}
	if claims["aud"] != "https://fcm.googleapis.com" || claims["sub"] != "https://roomdate.vercel.app" || claims["exp"] != float64(now.Add(12*time.Hour).Unix()) {
		t.Errorf("claims %v", claims)
	}
	// La firma si verifica con la chiave pubblica dell'header
	public, err := ecdsa.ParseUncompressedPublicKey(elliptic.P256(), mustB64(t, key))
	if err != nil {
		t.Fatal(err)
	}
	sig := mustB64(t, parts[2])
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if len(sig) != 64 || !ecdsa.Verify(public, digest[:], new(big.Int).SetBytes(sig[:32]), new(big.Int).SetBytes(sig[32:])) {
		t.Error("firma ES256 non valida")
	}
}

func TestEndpointsAllowed(t *testing.T) {
	e := Endpoints{Extra: []string{"http://127.0.0.1:9200"}}
	for raw, want := range map[string]bool{
		"https://fcm.googleapis.com/fcm/send/abc":                    true,
		"https://updates.push.services.mozilla.com/wpush/v2/abc":     true,
		"https://web.push.apple.com/QGuQyavXutnMH":                   true,
		"https://wns2-par02p.notify.windows.com/w/?token=abc":        true,
		"https://FCM.googleapis.com:443/x":                           true,
		"http://127.0.0.1:9200/push/1":                               true,
		"http://fcm.googleapis.com/fcm/send/abc":                     false,
		"https://fcm.googleapis.com:8443/x":                          false,
		"https://evil-fcm.googleapis.com.example.com/x":              false,
		"https://googleapis.com/x":                                   false,
		"https://169.254.169.254/latest/meta-data":                   false,
		"https://user:pass@fcm.googleapis.com/x":                     false,
		"http://127.0.0.1:9201/push/1":                               false,
		"https://localhost/x":                                        false,
		"not a url":                                                  false,
		"https://notify.windows.com.evil.example/x":                  false,
		"https://xnotify.windows.com/x":                              false,
		"https://fcm.googleapis.com.":                                false,
		"https://push.apple.com/x":                                   true,
		"https://web.push.apple.com@evil.example/x":                  false,
		"javascript:alert(1)":                                        false,
		"https://updates.push.services.mozilla.com/wpush/v2/abc#x":   true,
		"https://updates.push.services.mozilla.com/wpush/v2/abc?q=1": true,
	} {
		if got := e.Allowed(raw); got != want {
			t.Errorf("Allowed(%q) = %v, atteso %v", raw, got, want)
		}
	}
}

// Il mittente cifra per il browser, firma con VAPID, usa gli header giusti e riconosce le
// iscrizioni scadute.
func TestSend(t *testing.T) {
	type received struct {
		header http.Header
		body   []byte
	}
	got := make(chan received, 10)
	status := http.StatusCreated
	push := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		got <- received{r.Header.Clone(), body}
		w.WriteHeader(status)
	}))
	defer push.Close()

	keys, _ := GenerateKeys()
	sender := NewSender(keys, "https://roomdate.vercel.app", Endpoints{Extra: []string{push.URL}})
	ua, _ := ecdh.P256().GenerateKey(rand.Reader)
	auth := []byte("0123456789abcdef")
	sub := Subscription{Endpoint: push.URL + "/push/1", P256dh: b64.EncodeToString(ua.PublicKey().Bytes()), Auth: b64.EncodeToString(auth)}

	err := sender.Send(context.Background(), sub, Message{Payload: []byte(`{"type":"message"}`), TTL: 12 * time.Hour, Topic: "conv-7", Urgency: "high"})
	if err != nil {
		t.Fatal(err)
	}
	r := <-got
	for name, want := range map[string]string{"Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", "TTL": "43200", "Topic": "conv-7", "Urgency": "high"} {
		if r.header.Get(name) != want {
			t.Errorf("%s = %q, atteso %q", name, r.header.Get(name), want)
		}
	}
	if !strings.HasPrefix(r.header.Get("Authorization"), "vapid t=") || !strings.HasSuffix(r.header.Get("Authorization"), ", k="+keys.PublicKey()) {
		t.Errorf("Authorization = %q", r.header.Get("Authorization"))
	}
	plain, err := decrypt(r.body, mustRaw(t, ua), auth)
	if err != nil || string(plain) != `{"type":"message"}` {
		t.Fatalf("il browser legge %q, %v", plain, err)
	}

	status = http.StatusGone
	if err := sender.Send(context.Background(), sub, Message{Payload: []byte("x"), TTL: time.Minute}); !errors.Is(err, ErrGone) {
		t.Errorf("410: %v, atteso ErrGone", err)
	}
	<-got
	status = http.StatusNotFound
	if err := sender.Send(context.Background(), sub, Message{Payload: []byte("x"), TTL: time.Minute}); !errors.Is(err, ErrGone) {
		t.Errorf("404: %v, atteso ErrGone", err)
	}
	<-got
	status = http.StatusTooManyRequests
	if err := sender.Send(context.Background(), sub, Message{Payload: []byte("x"), TTL: time.Minute}); err == nil || errors.Is(err, ErrGone) {
		t.Errorf("429: %v", err)
	}
	<-got

	// Un server raggiungibile ma fuori dai servizi push ammessi: nessuna richiesta gli arriva
	var reached atomic.Bool
	outside := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached.Store(true)
		w.WriteHeader(http.StatusCreated)
	}))
	defer outside.Close()
	other := sub
	other.Endpoint = outside.URL + "/interno"
	if err := sender.Send(context.Background(), other, Message{Payload: []byte("x"), TTL: time.Minute}); err == nil {
		t.Error("indirizzo non ammesso accettato")
	}
	if reached.Load() {
		t.Error("richiesta inviata a un indirizzo non ammesso")
	}
}

// Un redirect del servizio push non si segue: potrebbe portare fuori dai servizi conosciuti.
func TestSendDoesNotFollowRedirects(t *testing.T) {
	inner := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("redirect seguito")
	}))
	defer inner.Close()
	push := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, inner.URL, http.StatusTemporaryRedirect)
	}))
	defer push.Close()
	keys, _ := GenerateKeys()
	sender := NewSender(keys, "https://roomdate.vercel.app", Endpoints{Extra: []string{push.URL, inner.URL}})
	ua, _ := ecdh.P256().GenerateKey(rand.Reader)
	sub := Subscription{Endpoint: push.URL + "/x", P256dh: b64.EncodeToString(ua.PublicKey().Bytes()), Auth: b64.EncodeToString(make([]byte, 16))}
	if err := sender.Send(context.Background(), sub, Message{Payload: []byte("x"), TTL: time.Minute}); err == nil {
		t.Error("un redirect non è un invio riuscito")
	}
}

func mustRaw(t *testing.T, k *ecdh.PrivateKey) []byte {
	t.Helper()
	return k.Bytes()
}
