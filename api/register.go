package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"github.com/microcosm-cc/bluemonday"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	Nome          string `json:"nome"`
	Cognome       string `json:"cognome"`
	Email         string `json:"email"`
	Password      string `json:"password"`
	Citta         string `json:"citta"`
	UserType      string `json:"userType"`
	Nascita       string `json:"nascita"`
	BudgetMax     int    `json:"budgetMax"`
	Occupation    string `json:"occupation"`
	Bio           string `json:"bio"`
	LifestyleTags string `json:"lifestyle_tags"`

	PublicKey           string `json:"publicKey"`
	EncryptedPrivateKey string `json:"encryptedPrivateKey"`
	CryptoSalt          string `json:"cryptoSalt"`
	CryptoIv            string `json:"cryptoIv"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dati non validi", http.StatusBadRequest)
		return
	}

	// 🧼 SANITIZZAZIONE XSS DEI CAMPI ANAGRAFICI E DESCRITTIVI
	p := bluemonday.StrictPolicy()
	safeNome := p.Sanitize(req.Nome)
	safeCognome := p.Sanitize(req.Cognome)
	safeCitta := p.Sanitize(req.Citta)
	safeOccupation := p.Sanitize(req.Occupation)
	safeBio := p.Sanitize(req.Bio)
	safeTags := p.Sanitize(req.LifestyleTags)

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Errore sicurezza", http.StatusInternalServerError)
		return
	}

	query := `INSERT INTO roomdate_app.users 
              (first_name, last_name, email, password_hash, citta, user_type, birthdate, budget_max, occupation, bio, lifestyle_tags, public_key, encrypted_private_key, crypto_salt, crypto_iv) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`

	var newID string
	err = db.QueryRow(
		query,
		safeNome,
		safeCognome,
		req.Email, // Le email sono solitamente validate da regex sul frontend/backend, la sanificazione XSS potrebbe alterare indirizzi particolari
		string(hashedPassword),
		safeCitta,
		req.UserType,
		req.Nascita,
		req.BudgetMax,
		safeOccupation,
		safeBio,
		safeTags,
		req.PublicKey,
		req.EncryptedPrivateKey, // MAI sanitizzare le chiavi crittografiche
		req.CryptoSalt,
		req.CryptoIv,
	).Scan(&newID)

	if err != nil {
		http.Error(w, "ERRORE REALE DEL DB: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"userId": newID,
	})
}
