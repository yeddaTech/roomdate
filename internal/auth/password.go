package auth

import (
	"crypto/rand"
	"crypto/subtle"
	_ "embed"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
)

// Parametri di Argon2id consigliati da OWASP per un server con poca memoria a disposizione
// (funzione serverless): 19 MiB, due passate, un thread.
const (
	argonMemory  = 19 * 1024
	argonTime    = 2
	argonThreads = 1
	argonKeyLen  = 32
	argonSaltLen = 16
)

//go:embed common_passwords.txt
var commonPasswordList string

var commonPasswords = sync.OnceValue(func() map[string]bool {
	set := map[string]bool{}
	for _, line := range strings.Split(commonPasswordList, "\n") {
		if password := strings.TrimSpace(line); password != "" {
			set[password] = true
		}
	}
	return set
})

// HashPassword calcola l'hash della password con Argon2id, nel formato standard PHC.
func HashPassword(password string) (string, error) {
	if len(password) > MaxPasswordBytes {
		return "", errors.New("password troppo lunga")
	}
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	b64 := base64.RawStdEncoding.EncodeToString
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads, b64(salt), b64(key)), nil
}

// CheckPassword verifica la password contro l'hash salvato.
// legacy è true quando l'hash è ancora bcrypt e va rifatto con Argon2id al primo accesso riuscito.
func CheckPassword(hash, password string) (ok bool, legacy bool) {
	if strings.HasPrefix(hash, "$argon2id$") {
		return checkArgon2(hash, password), false
	}
	if strings.HasPrefix(hash, "$2") {
		return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil, true
	}
	return false, false
}

func checkArgon2(hash, password string) bool {
	parts := strings.Split(hash, "$")
	if len(parts) != 6 {
		return false
	}
	var version, memory, time, threads int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return false
	}
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &time, &threads); err != nil {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false
	}
	// I parametri arrivano dall'hash salvato: un hash vecchio resta verificabile anche se cambiano
	key := argon2.IDKey([]byte(password), salt, uint32(time), uint32(memory), uint8(threads), uint32(len(expected)))
	return subtle.ConstantTimeCompare(key, expected) == 1
}

// PasswordProblem controlla la password secondo le linee guida NIST 800-63B: conta la lunghezza,
// non la presenza di simboli, e si rifiutano le password prevedibili.
// Restituisce il messaggio da mostrare, o stringa vuota se la password va bene.
func PasswordProblem(password, email, firstName string) string {
	if len([]rune(password)) < MinPasswordLength {
		return fmt.Sprintf("La password deve avere almeno %d caratteri", MinPasswordLength)
	}
	if len(password) > MaxPasswordBytes {
		return "La password è troppo lunga"
	}

	lower := strings.ToLower(password)
	if commonPasswords()[lower] {
		return "Questa password è tra le più usate: scegline una meno prevedibile"
	}
	if isRepeatedCharacter(lower) || isSequence(lower) {
		return "Questa password è troppo semplice: evita caratteri ripetuti o in sequenza"
	}

	localPart, _, _ := strings.Cut(strings.ToLower(email), "@")
	for _, personal := range []string{localPart, strings.ToLower(firstName)} {
		if len([]rune(personal)) >= 4 && strings.Contains(lower, personal) {
			return "La password non può contenere il tuo nome o la tua email"
		}
	}
	if strings.Contains(lower, "roomdate") {
		return "La password non può contenere il nome del sito"
	}
	return ""
}

func isRepeatedCharacter(password string) bool {
	for _, r := range password {
		if r != rune(password[0]) {
			return false
		}
	}
	return true
}

// isSequence riconosce le sequenze crescenti o decrescenti come "1234567890" e "abcdefghij".
func isSequence(password string) bool {
	runes := []rune(password)
	if len(runes) < 2 {
		return false
	}
	step := runes[1] - runes[0]
	if step != 1 && step != -1 {
		return false
	}
	for i := 2; i < len(runes); i++ {
		if runes[i]-runes[i-1] != step {
			return false
		}
	}
	return true
}

// Attese crescenti dopo tentativi di accesso falliti (modulo M3.2).
const (
	// ThrottleWindow è il periodo in cui si contano i tentativi falliti.
	ThrottleWindow = 15 * time.Minute
	// Tentativi tollerati prima di iniziare a far aspettare: per email e per provenienza.
	// La soglia per indirizzo IP è più alta perché una rete aziendale o un operatore mobile
	// fanno arrivare molte persone dallo stesso indirizzo.
	accountThreshold = 5
	ipThreshold      = 20
	baseDelay        = 30 * time.Second
	maxDelay         = 15 * time.Minute
)

// RetryAfter dice quanto bisogna ancora aspettare prima di riprovare ad accedere.
// Zero significa "si può provare subito".
func RetryAfter(f FailedLogins, now time.Time) time.Duration {
	delay := max(delayAfter(f.ByEmail, accountThreshold), delayAfter(f.ByIP, ipThreshold))
	if delay == 0 || f.LastAttempt.IsZero() {
		return 0
	}
	return max(delay-now.Sub(f.LastAttempt), 0)
}

// delayAfter raddoppia l'attesa a ogni tentativo oltre la soglia, fino al massimo.
func delayAfter(failures, threshold int) time.Duration {
	if failures < threshold {
		return 0
	}
	delay := baseDelay
	for i := threshold; i < failures && delay < maxDelay; i++ {
		delay *= 2
	}
	return min(delay, maxDelay)
}
