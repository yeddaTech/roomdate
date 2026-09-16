package backend

import (
	"encoding/json"
	"log"
	"net/http"

	_ "github.com/lib/pq"
)

type ListingRequest struct {
	// L'identità (UserID) la prendiamo dal token, quindi non ci serve nel JSON
	Title       string `json:"title"`
	City        string `json:"city"`
	Zone        string `json:"zone"`
	RoomType    string `json:"roomType"`
	Price       int    `json:"price"` // 🔴 FIX: Ora si aspetta un intero direttamente da React
	Description string `json:"description"`
}

func CreateListingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	// 🚨 1. CONTROLLO RBAC: Passa solo chi affitta
	if !checkRole(r, "affitta") {
		http.Error(w, "Accesso negato: Solo i proprietari possono creare annunci", http.StatusForbidden)
		return
	}

	// 🛡️ 2. ZERO-TRUST: Otteniamo l'ID in modo sicuro dal token
	secureUserID := getSecureUserID(r)
	if secureUserID == "" {
		http.Error(w, "Accesso negato: Sessione non valida", http.StatusUnauthorized)
		return
	}

	var err error // ✅ DICHIARATA CORRETTAMENTE QUI

	var req ListingRequest
	if err = json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dati non validi", http.StatusBadRequest)
		return
	}

	// 🧼 3. SANITIZZAZIONE ANTI-XSS
	// Rimuove ogni tag HTML e script, senza trasformare apostrofi e simboli in entità HTML
	safeTitle := sanitizeText(req.Title)
	safeCity := sanitizeText(req.City)
	safeZone := sanitizeText(req.Zone)
	safeDescription := sanitizeText(req.Description)

	// 🔴 RIMOSSO: priceInt, _ := strconv.Atoi(req.Price) non serve più!

	// 4. Salvataggio nel DB utilizzando SOLO i dati sanitizzati e l'ID sicuro
	query := `
        INSERT INTO roomdate_app.listings (user_id, title, city, zone, room_type, price, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `
	// 🔴 FIX: Passiamo direttamente req.Price
	_, err = DB.Exec(query, secureUserID, safeTitle, safeCity, safeZone, req.RoomType, req.Price, safeDescription)
	if err != nil {
		log.Printf("create_listing: %v", err)
		http.Error(w, "Impossibile pubblicare l'annuncio. Controlla i dati e riprova.", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Annuncio pubblicato in sicurezza!"})
}
