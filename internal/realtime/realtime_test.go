package realtime

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/pusher/pusher-http-go/v5"

	"roomdate-backend/internal/config"
)

// La firma deve essere quella che Pusher verifica: la confrontiamo con la libreria ufficiale e con
// l'esempio della documentazione di Pusher (chiave, segreto e risultato pubblicati lì).
func TestAuthorizeMatchesPusher(t *testing.T) {
	cfg := config.Pusher{AppID: "1", Key: "278d425bdf160c739803", Secret: "7ad3773142a6692b25b8"}
	authorizer := NewAuthorizer(cfg)

	got, err := authorizer.Authorize("1234.1234", "private-foobar")
	if err != nil || got != "278d425bdf160c739803:58df8b0c36d6982b82c3ecf6b4662e34fe8c25bba48f5369f135bf843651c3a4" {
		t.Fatalf("firma = %q, %v", got, err)
	}

	client := pusher.Client{AppID: cfg.AppID, Key: cfg.Key, Secret: cfg.Secret}
	channel := UserChannel("0b6f5f5e-6c1a-4d3e-9d2b-3f7e8a9c1d2e")
	response, err := client.AuthorizePrivateChannel([]byte("socket_id=98765.4321&channel_name=" + channel))
	if err != nil {
		t.Fatal(err)
	}
	var want struct {
		Auth string `json:"auth"`
	}
	if err := json.Unmarshal(response, &want); err != nil {
		t.Fatal(err)
	}
	if got, _ := authorizer.Authorize("98765.4321", channel); got != want.Auth {
		t.Fatalf("firma = %q, la libreria Pusher dà %q", got, want.Auth)
	}
}

func TestAuthorizeWithoutCredentials(t *testing.T) {
	if _, err := NewAuthorizer(config.Pusher{Key: "k"}).Authorize("1.2", "private-user-x"); !errors.Is(err, ErrDisabled) {
		t.Fatalf("errore = %v, atteso ErrDisabled", err)
	}
}

// Un host personalizzato in locale (server di sviluppo come soketi) usa HTTP; tutto il resto HTTPS.
func TestPublisherUsesHTTPSExceptLocally(t *testing.T) {
	for host, secure := range map[string]bool{"": true, "127.0.0.1:6001": false, "localhost:6001": false, "pusher.example.com": true} {
		p := New(config.Pusher{AppID: "1", Key: "k", Secret: "s", Host: host}).(*pusherPublisher)
		if p.client.Secure != secure || p.client.Host != host {
			t.Errorf("host %q: Secure = %v, Host = %q", host, p.client.Secure, p.client.Host)
		}
	}
}
