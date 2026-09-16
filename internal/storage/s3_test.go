package storage

// Test dello storage S3 contro un server compatibile che verifica le firme (ad esempio Garage o R2).
// Si attivano con TEST_S3_ENDPOINT, TEST_S3_BUCKET, TEST_S3_ACCESS_KEY_ID e TEST_S3_SECRET_ACCESS_KEY;
// senza, vengono saltati. Usano chiavi con prefisso "test/" e le eliminano alla fine.

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

func testStorage(t *testing.T) Storage {
	t.Helper()
	cfg := S3Config{
		Endpoint:        os.Getenv("TEST_S3_ENDPOINT"),
		Bucket:          os.Getenv("TEST_S3_BUCKET"),
		AccessKeyID:     os.Getenv("TEST_S3_ACCESS_KEY_ID"),
		SecretAccessKey: os.Getenv("TEST_S3_SECRET_ACCESS_KEY"),
		PublicURL:       "https://pubblico.test/foto",
	}
	if !cfg.Enabled() {
		t.Skip("TEST_S3_* non impostate")
	}
	return New(cfg)
}

func testKey(t *testing.T) string {
	b := make([]byte, 8)
	rand.Read(b)
	key := "test/" + hex.EncodeToString(b) + ".jpg"
	t.Cleanup(func() { testStorage(t).Delete(context.Background(), key) })
	return key
}

// put carica il file come fa il browser: una PUT sull'URL firmato con gli header indicati.
func put(t *testing.T, url string, headers map[string]string, body []byte) int {
	t.Helper()
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	io.Copy(io.Discard, res.Body)
	res.Body.Close()
	return res.StatusCode
}

func TestS3PresignedUploadAndObjectOperations(t *testing.T) {
	st := testStorage(t)
	ctx := context.Background()
	key := testKey(t)
	moved := testKey(t)
	data := append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, bytes.Repeat([]byte("x"), 2048)...)

	upload, err := st.PresignUpload(ctx, key, "image/jpeg", 5*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if upload.Headers["Content-Type"] != "image/jpeg" || strings.Contains(upload.URL, "x-amz-checksum") || strings.Contains(upload.URL, "x-amz-sdk-checksum") {
		t.Fatalf("caricamento = %+v", upload)
	}

	t.Run("la firma blocca un tipo diverso da quello autorizzato", func(t *testing.T) {
		if code := put(t, upload.URL, map[string]string{"Content-Type": "text/html"}, data); code != http.StatusForbidden {
			t.Fatalf("PUT con Content-Type diverso: %d, atteso 403", code)
		}
	})

	t.Run("la firma blocca una chiave diversa", func(t *testing.T) {
		other := strings.Replace(upload.URL, key, key+"x", 1)
		if code := put(t, other, upload.Headers, data); code != http.StatusForbidden {
			t.Fatalf("PUT su un'altra chiave: %d, atteso 403", code)
		}
	})

	if code := put(t, upload.URL, upload.Headers, data); code != http.StatusOK {
		t.Fatalf("PUT sull'URL firmato: %d", code)
	}

	info, err := st.Stat(ctx, key)
	if err != nil || info.Size != int64(len(data)) || info.ContentType != "image/jpeg" {
		t.Fatalf("Stat = %+v, %v", info, err)
	}
	head, err := st.ReadPrefix(ctx, key, 4)
	if err != nil || !bytes.Equal(head, data[:4]) {
		t.Fatalf("ReadPrefix = %x, %v", head, err)
	}

	if err := st.Move(ctx, key, moved); err != nil {
		t.Fatal(err)
	}
	if _, err := st.Stat(ctx, key); !errors.Is(err, ErrNotFound) {
		t.Fatalf("dopo Move l'originale esiste ancora: %v", err)
	}
	if info, err := st.Stat(ctx, moved); err != nil || info.Size != int64(len(data)) || info.ContentType != "image/jpeg" {
		t.Fatalf("Stat dopo Move = %+v, %v", info, err)
	}

	if err := st.Delete(ctx, moved); err != nil {
		t.Fatal(err)
	}
	if _, err := st.Stat(ctx, moved); !errors.Is(err, ErrNotFound) {
		t.Fatalf("dopo Delete: %v", err)
	}
	if err := st.Delete(ctx, moved); err != nil {
		t.Fatalf("eliminare un oggetto inesistente non è un errore: %v", err)
	}
	if _, err := st.ReadPrefix(ctx, moved, 4); !errors.Is(err, ErrNotFound) {
		t.Fatalf("ReadPrefix di un oggetto inesistente: %v", err)
	}
	if err := st.Move(ctx, moved, key); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Move di un oggetto inesistente: %v", err)
	}
	if got := st.PublicURL("listings/1/a.jpg"); got != "https://pubblico.test/foto/listings/1/a.jpg" {
		t.Fatalf("PublicURL = %s", got)
	}
}

func TestS3ExpiredUploadRejected(t *testing.T) {
	st := testStorage(t)
	key := testKey(t)
	upload, err := st.PresignUpload(context.Background(), key, "image/jpeg", time.Second)
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(2 * time.Second)
	// R2 e AWS rispondono 403, Garage 400: conta che il caricamento sia rifiutato
	if code := put(t, upload.URL, upload.Headers, []byte{0xFF, 0xD8, 0xFF}); code < 400 || code >= 500 {
		t.Fatalf("PUT con URL scaduto: %d, atteso un rifiuto 4xx", code)
	}
}

func TestDisabledStorage(t *testing.T) {
	st := New(S3Config{Endpoint: "https://x", Bucket: "b"})
	if _, ok := st.(Disabled); !ok {
		t.Fatal("con configurazione incompleta lo storage deve essere disattivato")
	}
	if _, err := st.PresignUpload(context.Background(), "k", "image/jpeg", time.Minute); !errors.Is(err, ErrDisabled) {
		t.Fatalf("errore = %v", err)
	}
}
