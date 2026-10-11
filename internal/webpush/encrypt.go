// Package webpush invia notifiche push ai browser secondo gli standard Web Push (modulo M2.8): il
// contenuto è cifrato per il browser destinatario (RFC 8291, codifica "aes128gcm" della RFC 8188)
// e il server si identifica al servizio push con le chiavi VAPID (RFC 8292). Solo la libreria
// standard di Go.
package webpush

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
)

// recordSize è la dimensione del record dichiarata nell'intestazione: il contenuto sta in un solo
// record, e i servizi push accettano al massimo 4096 byte in tutto.
const recordSize = 4096

// MaxPayload è il contenuto più lungo che si può inviare: 4096 byte meno l'intestazione (86), il
// delimitatore (1) e l'etichetta di autenticazione (16).
const MaxPayload = recordSize - 86 - 1 - 16

// Encrypt cifra il contenuto per un browser, con la chiave pubblica (p256dh, punto P-256 non
// compresso) e il segreto (auth, 16 byte) della sua iscrizione.
func Encrypt(plaintext, uaPublic, authSecret []byte) ([]byte, error) {
	asPrivate, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	return encrypt(plaintext, uaPublic, authSecret, asPrivate, salt)
}

// encrypt è Encrypt con la chiave effimera del server e il sale scelti da fuori (per i test).
func encrypt(plaintext, uaPublic, authSecret []byte, asPrivate *ecdh.PrivateKey, salt []byte) ([]byte, error) {
	if len(plaintext) > MaxPayload {
		return nil, fmt.Errorf("webpush: contenuto di %d byte, al massimo %d", len(plaintext), MaxPayload)
	}
	if len(authSecret) != 16 {
		return nil, errors.New("webpush: segreto auth non valido")
	}
	if len(salt) != 16 {
		return nil, errors.New("webpush: sale non valido")
	}
	uaKey, err := ecdh.P256().NewPublicKey(uaPublic)
	if err != nil {
		return nil, fmt.Errorf("webpush: chiave p256dh non valida: %w", err)
	}
	sharedSecret, err := asPrivate.ECDH(uaKey)
	if err != nil {
		return nil, err
	}
	asPublic := asPrivate.PublicKey().Bytes()

	// RFC 8291, sezione 3.4: dal segreto condiviso e da auth una chiave d'ingresso (IKM)...
	prkKey, err := hkdf.Extract(sha256.New, sharedSecret, authSecret)
	if err != nil {
		return nil, err
	}
	ikm, err := hkdf.Expand(sha256.New, prkKey, "WebPush: info\x00"+string(uaPublic)+string(asPublic), 32)
	if err != nil {
		return nil, err
	}
	// ...e da questa, con il sale, la chiave e il nonce di AES-128-GCM (RFC 8188, sezione 2.2)
	prk, err := hkdf.Extract(sha256.New, ikm, salt)
	if err != nil {
		return nil, err
	}
	cek, err := hkdf.Expand(sha256.New, prk, "Content-Encoding: aes128gcm\x00", 16)
	if err != nil {
		return nil, err
	}
	nonce, err := hkdf.Expand(sha256.New, prk, "Content-Encoding: nonce\x00", 12)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(cek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	// Intestazione: sale, dimensione del record, chiave pubblica effimera del server
	header := make([]byte, 0, 86+len(plaintext)+1+gcm.Overhead())
	header = append(header, salt...)
	header = binary.BigEndian.AppendUint32(header, recordSize)
	header = append(header, byte(len(asPublic))) // #nosec G115 -- punto P-256 non compresso: sempre 65 byte
	header = append(header, asPublic...)
	// Un solo record, che è anche l'ultimo: il contenuto seguito dal delimitatore 0x02
	record := append(append(make([]byte, 0, len(plaintext)+1), plaintext...), 0x02)
	return gcm.Seal(header, nonce, record, nil), nil
}
