package backend

import (
	"database/sql"
	"encoding/json"
	"fmt"
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

	// Variabile err dichiarata a livello di handler per evitare problemi di scope/ridefinizione
	var err error

	switch req.Action {

	// --- VALIDAZIONE DELLA SESSIONE (ZERO-TRUST) ---
	case "validate_session":
		cookie, err := r.Cookie("roomdate_session")
		if err != nil {
			http.Error(w, "Sessione inesistente o scaduta", http.StatusUnauthorized)
			return
		}

		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			http.Error(w, "Errore configurazione server", http.StatusInternalServerError)
			return
		}

		token, err := jwt.Parse(cookie.Value, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("metodo di firma inatteso: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Token non valido o scaduto", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "Errore nella lettura dei claims", http.StatusUnauthorized)
			return
		}

		var userIDStr string
		switch v := claims["user_id"].(type) {
		case string:
			userIDStr = v
		case float64:
			userIDStr = fmt.Sprintf("%.0f", v)
		default:
			http.Error(w, "Formato ID utente non valido nel token", http.StatusUnauthorized)
			return
		}

		var user UserData
		query := `SELECT id::text, first_name, last_name, email, COALESCE(user_type, '')
                  FROM roomdate_app.users WHERE id = $1`

		err = DB.QueryRow(query, userIDStr).Scan(&user.ID, &user.Nome, &user.Cognome, &user.Email, &user.UserType)
		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Utente non trovato", http.StatusUnauthorized)
				return
			}
			http.Error(w, "Errore DB: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(user)
		return

	// --- UPDATE PASSWORD ---
	case "update_password":
		secureUserID := getSecureUserID(r)
		if secureUserID == "" {
			http.Error(w, "Accesso negato o sessione non valida", http.StatusUnauthorized)
			return
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "Errore crittografia", http.StatusInternalServerError)
			return
		}
		query := `UPDATE roomdate_app.users SET password_hash = $1 WHERE id = $2`
		_, err = DB.Exec(query, hashedPassword, secureUserID)
		if err != nil {
			http.Error(w, "Errore DB: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Password aggiornata con successo"))
		return

	// --- DELETE ACCOUNT ---
	case "delete_account":
		secureUserID := getSecureUserID(r)
		if secureUserID == "" {
			http.Error(w, "Accesso negato o sessione non valida", http.StatusUnauthorized)
			return
		}

		query := `DELETE FROM roomdate_app.users WHERE id = $1`
		_, err = DB.Exec(query, secureUserID)
		if err != nil {
			http.Error(w, "Errore DB: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Account eliminato"))
		return

	// --- LOGIN STANDARD CON PROTEZIONE BRUTE-FORCE ---
	default:
		var user UserData
		var hashedPassword string
		var encryptedPrivKey, cryptoSalt, cryptoIv, pubKey string
		var failedAttempts int
		var lockedUntil sql.NullTime

		query := `SELECT id::text, first_name, last_name, email, password_hash, COALESCE(user_type, ''), 
                  COALESCE(encrypted_private_key, ''), COALESCE(crypto_salt, ''), COALESCE(crypto_iv, ''),
                  COALESCE(public_key, ''), COALESCE(failed_login_attempts, 0), locked_until
                  FROM roomdate_app.users WHERE email = $1`

		err = DB.QueryRow(query, req.Email).Scan(
			&user.ID, &user.Nome, &user.Cognome, &user.Email, &hashedPassword, &user.UserType,
			&encryptedPrivKey, &cryptoSalt, &cryptoIv, &pubKey, &failedAttempts, &lockedUntil,
		)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Email non trovata", http.StatusUnauthorized)
				return
			}
			http.Error(w, "Errore DB: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// 🛑 1. CONTROLLO BLOCCO ACCOUNT
		if lockedUntil.Valid && lockedUntil.Time.After(time.Now()) {
			http.Error(w, "Account temporaneamente bloccato per troppi tentativi. Riprova tra 15 minuti.", http.StatusTooManyRequests)
			return
		}

		// 🛡️ 2. VERIFICA PASSWORD E GESTIONE ERRORI
		err = bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password))
		if err != nil {
			failedAttempts++

			if failedAttempts >= 5 {
				lockQuery := `UPDATE roomdate_app.users SET failed_login_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE email = $2`
				DB.Exec(lockQuery, failedAttempts, req.Email)
				http.Error(w, "Troppi tentativi falliti. Account bloccato per 15 minuti.", http.StatusTooManyRequests)
				return
			}

			updateQuery := `UPDATE roomdate_app.users SET failed_login_attempts = $1 WHERE email = $2`
			DB.Exec(updateQuery, failedAttempts, req.Email)
			http.Error(w, "Password errata", http.StatusUnauthorized)
			return
		}

		// ✅ 3. PASSWORD CORRETTA: RESET CONTATORI
		if failedAttempts > 0 {
			resetQuery := `UPDATE roomdate_app.users SET failed_login_attempts = 0, locked_until = NULL WHERE email = $1`
			DB.Exec(resetQuery, req.Email)
		}

		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			http.Error(w, "Errore configurazione server", http.StatusInternalServerError)
			return
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id":   user.ID,
			"user_type": user.UserType,
			"exp":       time.Now().Add(24 * time.Hour).Unix(),
		})

		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			http.Error(w, "Errore generazione token", http.StatusInternalServerError)
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     "roomdate_session",
			Value:    tokenString,
			Expires:  time.Now().Add(24 * time.Hour),
			Path:     "/",
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteStrictMode,
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

// =====================================================================
// 🛡️ HELPER FUNCTIONS
// =====================================================================

func getSecureUserID(r *http.Request) string {
	cookie, err := r.Cookie("roomdate_session")
	if err != nil {
		return ""
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	token, err := jwt.Parse(cookie.Value, func(token *jwt.Token) (interface{}, error) {
		return []byte(jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return ""
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return ""
	}
	switch v := claims["user_id"].(type) {
	case string:
		return v
	case float64:
		return fmt.Sprintf("%.0f", v)
	}
	return ""
}

func checkRole(r *http.Request, requiredRole string) bool {
	cookie, err := r.Cookie("roomdate_session")
	if err != nil {
		return false
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	token, err := jwt.Parse(cookie.Value, func(token *jwt.Token) (interface{}, error) {
		return []byte(jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return false
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return false
	}
	userType, ok := claims["user_type"].(string)
	if !ok || userType != requiredRole {
		return false
	}
	return true
}
