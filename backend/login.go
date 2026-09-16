package backend

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type MultiRequest struct {
	Action          string `json:"action"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	UserID          string `json:"userId"`
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`

	// Chiave privata E2EE cifrata di nuovo con la nuova password (solo per update_password)
	EncryptedPrivateKey string `json:"encryptedPrivateKey"`
	CryptoSalt          string `json:"cryptoSalt"`
	CryptoIv            string `json:"cryptoIv"`
}

// SecureCookies imposta il flag Secure sul cookie di sessione. Resta true in produzione:
// solo il server di sviluppo locale (cmd/dev, in HTTP) lo disattiva.
var SecureCookies = true

// clearSessionCookie chiede al browser di eliminare il cookie di sessione.
func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "roomdate_session",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   SecureCookies,
		SameSite: http.SameSiteLaxMode,
	})
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
			log.Printf("validate_session: %v", err)
			http.Error(w, "Errore interno del server", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(user)
		return

	// --- LOGOUT ---
	case "logout":
		clearSessionCookie(w)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Logout effettuato"))
		return

	// --- UPDATE PASSWORD ---
	case "update_password":
		secureUserID := getSecureUserID(r)
		if secureUserID == "" {
			http.Error(w, "Accesso negato o sessione non valida", http.StatusUnauthorized)
			return
		}

		if len(req.NewPassword) < 6 {
			http.Error(w, "La nuova password deve avere almeno 6 caratteri", http.StatusBadRequest)
			return
		}

		var currentHash, storedVault string
		var failedAttempts int
		var lockedUntil sql.NullTime
		err = DB.QueryRow(`SELECT password_hash, COALESCE(encrypted_private_key, ''), COALESCE(failed_login_attempts, 0), locked_until
                           FROM roomdate_app.users WHERE id = $1`, secureUserID).Scan(&currentHash, &storedVault, &failedAttempts, &lockedUntil)
		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Accesso negato o sessione non valida", http.StatusUnauthorized)
				return
			}
			log.Printf("update_password: lettura utente: %v", err)
			http.Error(w, "Errore interno del server", http.StatusInternalServerError)
			return
		}

		if lockedUntil.Valid && lockedUntil.Time.After(time.Now()) {
			http.Error(w, "Account temporaneamente bloccato per troppi tentativi. Riprova tra 15 minuti.", http.StatusTooManyRequests)
			return
		}

		// 🔐 Senza la chiave privata cifrata di nuovo, i messaggi E2EE diventerebbero illeggibili
		hasVault := storedVault != ""
		if hasVault && (req.EncryptedPrivateKey == "" || req.CryptoSalt == "" || req.CryptoIv == "") {
			http.Error(w, "Chiavi di cifratura mancanti: esci, accedi di nuovo e riprova", http.StatusBadRequest)
			return
		}

		// 🛡️ La password attuale è obbligatoria: una sessione rubata non basta per cambiarla.
		// Gli errori contano come tentativi di login falliti.
		if bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(req.CurrentPassword)) != nil {
			failedAttempts++
			if failedAttempts >= 5 {
				DB.Exec(`UPDATE roomdate_app.users SET failed_login_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $2`, failedAttempts, secureUserID)
				http.Error(w, "Troppi tentativi falliti. Account bloccato per 15 minuti.", http.StatusTooManyRequests)
				return
			}
			DB.Exec(`UPDATE roomdate_app.users SET failed_login_attempts = $1 WHERE id = $2`, failedAttempts, secureUserID)
			http.Error(w, "La password attuale non è corretta", http.StatusUnauthorized)
			return
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "Errore crittografia", http.StatusInternalServerError)
			return
		}

		// Password e chiave privata cambiano insieme, in un'unica istruzione.
		// La chiave viene sostituita solo se l'utente ne aveva già una.
		query := `
            UPDATE roomdate_app.users
            SET password_hash = $1,
                encrypted_private_key = CASE WHEN COALESCE(encrypted_private_key, '') <> '' THEN $2 ELSE encrypted_private_key END,
                crypto_salt = CASE WHEN COALESCE(encrypted_private_key, '') <> '' THEN $3 ELSE crypto_salt END,
                crypto_iv = CASE WHEN COALESCE(encrypted_private_key, '') <> '' THEN $4 ELSE crypto_iv END,
                failed_login_attempts = 0,
                locked_until = NULL
            WHERE id = $5
        `
		_, err = DB.Exec(query, string(hashedPassword), req.EncryptedPrivateKey, req.CryptoSalt, req.CryptoIv, secureUserID)
		if err != nil {
			log.Printf("update_password: aggiornamento: %v", err)
			http.Error(w, "Errore interno del server", http.StatusInternalServerError)
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
			log.Printf("delete_account: %v", err)
			http.Error(w, "Impossibile eliminare l'account in questo momento", http.StatusInternalServerError)
			return
		}
		clearSessionCookie(w)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Account eliminato"))
		return

	// --- LOGIN STANDARD ---
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
			log.Printf("login: %v", err)
			http.Error(w, "Errore interno del server", http.StatusInternalServerError)
			return
		}

		if lockedUntil.Valid && lockedUntil.Time.After(time.Now()) {
			http.Error(w, "Account temporaneamente bloccato per troppi tentativi. Riprova tra 15 minuti.", http.StatusTooManyRequests)
			return
		}

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
			Secure:   SecureCookies,
			SameSite: http.SameSiteLaxMode, // 👈 Modificato da Strict a Lax per stabilità su Vercel
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
