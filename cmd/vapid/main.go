// Comando vapid: crea le chiavi VAPID per le notifiche push (modulo M2.8).
//
//	go run ./cmd/vapid
//
// Stampa la chiave privata da mettere nella variabile d'ambiente VAPID_PRIVATE_KEY (su Vercel e
// in .env.local) e, per controllo, la pubblica che il server ne ricava. Cambiare la chiave rende
// inutili le iscrizioni esistenti: i browser vanno reiscritti dalle impostazioni.
package main

import (
	"fmt"
	"os"

	"roomdate-backend/internal/webpush"
)

func main() {
	keys, err := webpush.GenerateKeys()
	if err != nil {
		fmt.Fprintln(os.Stderr, "creazione delle chiavi:", err)
		os.Exit(1)
	}
	fmt.Println("VAPID_PRIVATE_KEY=" + keys.PrivateKey())
	fmt.Println()
	fmt.Println("Chiave pubblica (la ricava il server, non serve impostarla):", keys.PublicKey())
}
