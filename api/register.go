package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"

	_ "github.com/lib/pq"
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

	// --- NUOVI CAMPI CRITTOGRAFICI ---
	PublicKey           string `json:"publicKey"`
	EncryptedPrivateKey string `json:"encryptedPrivateKey"`
	CryptoSalt          string `json:"cryptoSalt"`
	CryptoIv            string `json:"cryptoIv"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	// --- 1. GESTIONE CORS PREFLIGHT ---
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// --- 2. BLOCCA TUTTO CIO' CHE NON E' UNA POST ---
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	// --- 3. CONNESSIONE AL DATABASE ---
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// --- 4. PARSING DEL JSON ---
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dati non validi", http.StatusBadRequest)
		return
	}

	// --- 5. HASHING DELLA PASSWORD ---
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Errore sicurezza", http.StatusInternalServerError)
		return
	}

	// --- 6. INSERIMENTO NEL DB ---
	query := `INSERT INTO roomdate_app.users 
			  (first_name, last_name, email, password_hash, citta, user_type, birthdate, budget_max, occupation, bio, lifestyle_tags, public_key, encrypted_private_key, crypto_salt, crypto_iv) 
			  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`

	var newID string
	err = db.QueryRow(
		query,
		req.Nome,
		req.Cognome,
		req.Email,
		string(hashedPassword),
		req.Citta,
		req.UserType,
		req.Nascita,
		req.BudgetMax,
		req.Occupation,
		req.Bio,
		req.LifestyleTags,
		req.PublicKey,
		req.EncryptedPrivateKey,
		req.CryptoSalt,
		req.CryptoIv,
	).Scan(&newID)

	if err != nil {
		// Nota: in un ambiente di produzione rigido, stampare l'errore reale del DB
		// può essere un rischio (information disclosure). Finché sei in fase di test, va benissimo.
		http.Error(w, "ERRORE REALE DEL DB: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// --- 7. RISPOSTA DI SUCCESSO ---
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"userId": newID,
	})
}
