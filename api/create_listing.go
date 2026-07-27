package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strconv"

	// Rimosso l'import di jwt qui perché lo usiamo tramite le funzioni in login.go
	_ "github.com/lib/pq"
)

type ListingRequest struct {
	// ⚠️ RIMOSSO: UserID string `json:"userId"`
	// Non ci fidiamo più dei dati identificativi provenienti dal client.
	Title       string `json:"title"`
	City        string `json:"city"`
	Zone        string `json:"zone"`
	RoomType    string `json:"roomType"`
	Price       string `json:"price"`
	Description string `json:"description"`
}

func CreateListingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	// 🚨 1. CONTROLLO RBAC (Autorizzazione):
	// Sostituisci "affitta" con la stringa esatta che usi nel tuo database per i proprietari
	if !checkRole(r, "affitta") {
		http.Error(w, "Accesso negato: Solo i proprietari possono creare annunci", http.StatusForbidden)
		return
	}

	// 🛡️ 2. ZERO-TRUST (Autenticazione ID):
	// Leggiamo l'ID utente in modo sicuro direttamente dall'armatura del token JWT
	secureUserID := getSecureUserID(r)
	if secureUserID == "" {
		http.Error(w, "Accesso negato: Sessione non valida", http.StatusUnauthorized)
		return
	}

	var req ListingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dati non validi", http.StatusBadRequest)
		return
	}

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore di connessione al DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// Convertiamo il prezzo da testo a numero
	priceInt, _ := strconv.Atoi(req.Price)

	// 3. Inseriamo secureUserID nella query al posto di req.UserID
	query := `
        INSERT INTO roomdate_app.listings (user_id, title, city, zone, room_type, price, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `
	_, err = db.Exec(query, secureUserID, req.Title, req.City, req.Zone, req.RoomType, priceInt, req.Description)
	if err != nil {
		http.Error(w, "Errore salvataggio annuncio: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Annuncio pubblicato con successo!"})
}
