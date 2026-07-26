package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type MultiRequest struct {
	Action      string `json:"action"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	UserID      string `json:"userId"`
	NewPassword string `json:"newPassword"`
}

type UserData struct {
	ID       string `json:"id"`
	Nome     string `json:"nome"`
	Cognome  string `json:"cognome"`
	Email    string `json:"email"`
	UserType string `json:"user_type"`
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	// --- 1. GESTIONE CORS PREFLIGHT ---
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// --- 2. BLOCCA METODI NON CONSENTITI ---
	if r.Method != http.MethodPost {
		http.Error(w, "Metodo non consentito", http.StatusMethodNotAllowed)
		return
	}

	var req MultiRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Dati non validi", http.StatusBadRequest)
		return
	}

	connStr := os.Getenv("DATABASE_URL")
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		http.Error(w, "Errore DB", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	switch req.Action {

	case "update_password":
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "Errore crittografia", http.StatusInternalServerError)
			return
		}
		query := `UPDATE roomdate_app.users SET password_hash = $1 WHERE id = $2`
		_, err = db.Exec(query, hashedPassword, req.UserID)
		if err != nil {
			http.Error(w, "Errore DB: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Password aggiornata con successo"))
		return

	case "delete_account":
		query := `DELETE FROM roomdate_app.users WHERE id = $1`
		_, err = db.Exec(query, req.UserID)
		if err != nil {
			http.Error(w, "Errore DB: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Account eliminato"))
		return

	default:
		var user UserData
		var hashedPassword string
		var encryptedPrivKey, cryptoSalt, cryptoIv, pubKey string

		query := `SELECT id::text, first_name, last_name, email, password_hash, COALESCE(user_type, ''), 
                  COALESCE(encrypted_private_key, ''), COALESCE(crypto_salt, ''), COALESCE(crypto_iv, ''),
                  COALESCE(public_key, '')
                  FROM roomdate_app.users WHERE email = $1`

		err = db.QueryRow(query, req.Email).Scan(
			&user.ID, &user.Nome, &user.Cognome, &user.Email, &hashedPassword, &user.UserType,
			&encryptedPrivKey, &cryptoSalt, &cryptoIv, &pubKey,
		)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Email non trovata", http.StatusUnauthorized)
				return
			}
			http.Error(w, "Errore DB: "+err.Error(), http.StatusInternalServerError)
			return
		}

		err = bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password))
		if err != nil {
			http.Error(w, "Password errata", http.StatusUnauthorized)
			return
		}

		// --- 🛡️ 3. GENERAZIONE JWT ---
		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			http.Error(w, "Errore configurazione server", http.StatusInternalServerError)
			return
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": user.ID,
			"exp":     time.Now().Add(24 * time.Hour).Unix(), // Scade in 24 ore
		})

		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			http.Error(w, "Errore generazione token", http.StatusInternalServerError)
			return
		}

		// --- 🍪 4. SETTAGGIO COOKIE HTTPONLY ---
		http.SetCookie(w, &http.Cookie{
			Name:     "roomdate_session",
			Value:    tokenString,
			Expires:  time.Now().Add(24 * time.Hour),
			Path:     "/",
			HttpOnly: true,                    // La VERA armatura: invisibile a JS
			Secure:   true,                    // Richiede HTTPS (perfetto per Vercel)
			SameSite: http.SameSiteStrictMode, // Blocca attacchi CSRF
		})

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message":             "Login effettuato con successo",
			"user":                user,
			"encryptedPrivateKey": encryptedPrivKey,
			"cryptoSalt":          cryptoSalt,
			"cryptoIv":            cryptoIv,
			"publicKey":           pubKey,
		})
	}
}
