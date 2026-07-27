package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strconv"

	_ "github.com/lib/pq"
	"github.com/microcosm-cc/bluemonday"
)

type ListingRequest struct {
	// L'identità (UserID) la prendiamo dal token, quindi non ci serve nel JSON
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

	var req ListingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dati non validi", http.StatusBadRequest)
		return
	}

	// 🧼 3. SANITIZZAZIONE ANTI-XSS
	// StrictPolicy rimuove chirurgicamente ogni traccia di tag HTML e script
	p := bluemonday.StrictPolicy()

	safeTitle := p.Sanitize(req.Title)
	safeCity := p.Sanitize(req.City)
	safeZone := p.Sanitize(req.Zone)
	safeDescription := p.Sanitize(req.Description)

	// Convertiamo il prezzo da testo a numero
	priceInt, _ := strconv.Atoi(req.Price)

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore di connessione al DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// 4. Salvataggio nel DB utilizzando SOLO i dati sanitizzati e l'ID sicuro
	query := `
        INSERT INTO roomdate_app.listings (user_id, title, city, zone, room_type, price, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `
	_, err = db.Exec(query, secureUserID, safeTitle, safeCity, safeZone, req.RoomType, priceInt, safeDescription)
	if err != nil {
		http.Error(w, "Errore salvataggio annuncio: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Annuncio pubblicato in sicurezza!"})
}
