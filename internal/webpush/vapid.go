package webpush

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"
)

var b64 = base64.RawURLEncoding

// Keys sono le chiavi VAPID del server (P-256, RFC 8292): con la pubblica il browser si iscrive
// alle notifiche di questo server, con la privata il server firma le richieste al servizio push.
type Keys struct {
	private *ecdsa.PrivateKey
	public  []byte
}

// ParsePrivateKey legge la chiave privata VAPID (32 byte in Base64 URL, come la stampa
// cmd/vapid); la pubblica si ricava da questa.
func ParsePrivateKey(encoded string) (*Keys, error) {
	raw, err := b64.DecodeString(strings.TrimRight(strings.TrimSpace(encoded), "="))
	if err != nil {
		return nil, fmt.Errorf("webpush: chiave VAPID non in Base64 URL: %w", err)
	}
	private, err := ecdsa.ParseRawPrivateKey(elliptic.P256(), raw)
	if err != nil {
		return nil, fmt.Errorf("webpush: chiave VAPID non valida: %w", err)
	}
	return newKeys(private)
}

// GenerateKeys crea una nuova coppia di chiavi VAPID.
func GenerateKeys() (*Keys, error) {
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	return newKeys(private)
}

func newKeys(private *ecdsa.PrivateKey) (*Keys, error) {
	public, err := private.PublicKey.Bytes()
	if err != nil {
		return nil, err
	}
	return &Keys{private: private, public: public}, nil
}

// PublicKey è la chiave pubblica (punto non compresso, Base64 URL) che il browser usa per iscriversi.
func (k *Keys) PublicKey() string {
	return b64.EncodeToString(k.public)
}

// PrivateKey è la chiave privata in Base64 URL, da mettere in VAPID_PRIVATE_KEY.
func (k *Keys) PrivateKey() string {
	raw, err := k.private.Bytes()
	if err != nil {
		panic(err) // non succede con una chiave P-256 valida
	}
	return b64.EncodeToString(raw)
}

// authorization è l'header Authorization di una richiesta al servizio push di endpoint: un JWT
// firmato con ES256 che dice a chi è destinato (aud), quando scade (exp, al massimo 24 ore) e chi
// lo manda (sub, un indirizzo del sito o una mailto:).
func (k *Keys) authorization(endpoint *url.URL, subject string, now time.Time) (string, error) {
	claims, err := json.Marshal(map[string]any{
		"aud": endpoint.Scheme + "://" + endpoint.Host,
		"exp": now.Add(12 * time.Hour).Unix(),
		"sub": subject,
	})
	if err != nil {
		return "", err
	}
	input := b64.EncodeToString([]byte(`{"typ":"JWT","alg":"ES256"}`)) + "." + b64.EncodeToString(claims)
	digest := sha256.Sum256([]byte(input))
	r, s, err := ecdsa.Sign(rand.Reader, k.private, digest[:])
	if err != nil {
		return "", err
	}
	// ES256: r e s affiancati, 32 byte ciascuno (non la codifica ASN.1)
	signature := make([]byte, 64)
	r.FillBytes(signature[:32])
	s.FillBytes(signature[32:])
	return "vapid t=" + input + "." + b64.EncodeToString(signature) + ", k=" + k.PublicKey(), nil
}
