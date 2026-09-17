// Popola un database di SVILUPPO con utenti, annunci e chat di prova.
//
//	go run ./cmd/seed          inserisce i dati di prova
//	go run ./cmd/seed -reset   elimina i dati di prova esistenti e li reinserisce
//
// Si rifiuta di partire se il database contiene utenti reali (email diverse da @seed.roomdate.test),
// quindi non può toccare la produzione. Tutti gli utenti di prova hanno password "roomdate-dev".
// Le chiavi E2EE sono generate come nel browser (src/utils/crypto.js), quindi le chat si leggono dall'app.
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"database/sql"
	"encoding/base64"
	"flag"
	"fmt"
	"log"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"

	"roomdate-backend/internal/devenv"
)

const (
	seedPassword     = "roomdate-dev"
	seedDomain       = "@seed.roomdate.test"
	seedEmailPattern = "%" + seedDomain

	// Stessi parametri di src/utils/crypto.js
	rsaBits          = 2048
	pbkdf2Iterations = 100000
)

type seedUser struct {
	key, nome, cognome, citta, userType, nascita string
	budget                                       int
	occupation, bio                              string
	tags                                         []string // chiavi di shared/options.json
	public                                       bool
}

type seedListing struct {
	owner, title, city, zone, roomType string
	price, daysAgo                     int
	description                        string
	amenities                          []string
	billsIncluded                      bool
	availableInDays                    int // giorni da oggi alla disponibilità; 0 = subito
}

type seedMessage struct {
	from       string
	minutesAgo int
	text       string
}

type seedConversation struct {
	tenant, user2 string // user2 vuoto per le chat su annuncio
	listing       int    // indice in listings, -1 per le chat dirette
	messages      []seedMessage
}

// I testi contengono apposta apostrofi e "&": devono comparire così nell'app (anomalia F1).
var users = []seedUser{
	{"giulia", "Giulia", "Bianchi", "Milano", "cerca", "1999-04-12", 650, "studente",
		"Studentessa al Politecnico, cerco una stanza luminosa vicino all'università. Amo cucinare & tenere la casa in ordine.",
		[]string{"non_fumatore", "ordinato", "socievole"}, true},
	{"marco", "Marco", "Rossi", "Milano", "affitta", "1990-09-03", 0, "lavoratore",
		"Ho una singola libera in zona Isola: casa tranquilla, ben collegata e con un gatto molto socievole.",
		[]string{"non_fumatore", "animali"}, true},
	{"sara", "Sara", "Conti", "Bologna", "cerca", "2001-01-20", 450, "studente",
		"Fuorisede a Bologna, cerco coinquilini con cui condividere cene e serate film.",
		[]string{"non_fumatore", "socievole", "vegetariano"}, true},
	{"luca", "Luca", "Ferri", "Roma", "affitta", "1987-06-15", 0, "lavoratore",
		"Affitto stanze a Roma a studenti e giovani lavoratori. Rispondo in giornata.",
		[]string{"fumatore"}, true},
	{"elena", "Elena", "Galli", "Torino", "cerca", "1998-11-02", 500, "studente_lavoratore",
		"Profilo privato di prova: non deve comparire nella ricerca dei coinquilini.",
		[]string{"non_fumatore"}, false},
	{"davide", "Davide", "Moretti", "Milano", "cerca", "2000-07-08", 600, "studente_lavoratore",
		"Lavoro part-time e studio in Statale. Cerco casa in zona Città Studi con persone ordinate.",
		[]string{"non_fumatore", "ordinato"}, true},
	{"chiara", "Chiara", "Esposito", "Milano", "cerca", "1996-03-25", 900, "lavoratore",
		"Nuova a Milano per lavoro, fumo solo sul balcone. Mi piacciono i coinquilini con cui fare due chiacchiere.",
		[]string{"fumatore", "animali", "socievole"}, true},
}

var listings = []seedListing{
	{"marco", "Singola luminosa in zona Isola", "Milano", "Isola", "singola", 650, 2,
		"Stanza singola arredata in un trilocale al terzo piano con ascensore. A 5 minuti dalla M5, spese condominiali incluse. Cerchiamo una persona tranquilla e ordinata.",
		[]string{"wifi", "arredata", "lavatrice", "ascensore", "animali_ammessi"}, true, 0},
	{"marco", "Doppia con balcone vicino all'M5", "Milano", "Isola", "doppia", 480, 6,
		"Posto letto in doppia con balcone. Cucina abitabile, lavatrice & wi-fi veloce. Ideale per studenti del Politecnico.",
		[]string{"wifi", "arredata", "lavatrice", "balcone"}, false, 30},
	{"luca", "Doppia a Prati, vicino alla metro", "Roma", "Prati", "doppia", 520, 1,
		"Doppia spaziosa a due passi dalla fermata Lepanto. Casa condivisa con altre due persone, zona piena di servizi.",
		[]string{"wifi", "riscaldamento"}, false, 0},
	{"luca", "Singola arredata con bagno privato", "Roma", "San Giovanni", "singola", 700, 10,
		"Singola con bagno privato in un appartamento ristrutturato. Contratto minimo 12 mesi, disponibile da subito.",
		[]string{"wifi", "arredata", "lavastoviglie", "aria_condizionata", "bagno_privato"}, true, 0},
}

var conversations = []seedConversation{
	{tenant: "giulia", listing: 0, messages: []seedMessage{
		{"giulia", 180, "Ciao Marco! La singola in zona Isola è ancora disponibile?"},
		{"marco", 165, "Ciao Giulia, sì! Se vuoi puoi passare a vederla giovedì pomeriggio."},
		{"giulia", 150, "Perfetto, giovedì alle 18 va benissimo. Le spese sono incluse?"},
	}},
	{tenant: "sara", user2: "giulia", listing: -1, messages: []seedMessage{
		{"sara", 60, "Ciao! Ho visto che cerchi casa anche tu: ti andrebbe di cercarla insieme?"},
		{"giulia", 45, "Volentieri! Io però sono a Milano, tu resti a Bologna?"},
		// Messaggio lungo: con la cifratura ibrida non c'è più il limite di 190 byte (anomalia F8)
		{"sara", 30, "Sì, per ora resto a Bologna almeno fino a giugno, poi si vedrà: dipende da dove trovo lavoro. " +
			"Intanto possiamo guardare insieme gli annunci e confrontare i prezzi delle due città, così capiamo " +
			"quanto budget serve e quali zone conviene guardare. Ho messo da parte qualche annuncio vicino " +
			"all'università, con le spese incluse e la lavatrice: te li giro appena riesco, insieme ai contatti " +
			"delle agenzie che mi hanno risposto in modo serio. Fammi sapere quando hai mezz'ora libera!"},
	}},
}

type userKeys struct {
	id                                     string
	publicKey                              *rsa.PublicKey
	publicB64, vault, cryptoSalt, cryptoIv string
}

func main() {
	log.SetFlags(0)
	reset := flag.Bool("reset", false, "elimina i dati di prova esistenti e li reinserisce")
	envFile := flag.String("env", ".env.local", "file con le variabili d'ambiente")
	flag.Parse()

	if _, err := devenv.Load(*envFile); err != nil {
		log.Fatalf("Errore nel file %s: %v", *envFile, err)
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL non impostata: copia .env.example in .env.local e compilala")
	}
	host, dbname := devenv.DescribeDSN(dsn)
	log.Printf("Database: %s / %s", host, dbname)

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		log.Fatalf("Connessione non valida: %v", err)
	}
	defer db.Close()

	// 🛡️ Protezione: mai su un database con utenti reali
	var realUsers, seedUsers int
	err = db.QueryRow(`SELECT COUNT(*) FILTER (WHERE email NOT LIKE $1), COUNT(*) FILTER (WHERE email LIKE $1)
                       FROM roomdate_app.users`, seedEmailPattern).Scan(&realUsers, &seedUsers)
	if err != nil {
		log.Fatalf("Impossibile leggere gli utenti (hai eseguito le migrazioni?): %v", err)
	}
	if realUsers > 0 {
		log.Fatalf("Il database contiene %d utenti reali: il seed si usa solo su database di sviluppo.", realUsers)
	}
	if seedUsers > 0 && !*reset {
		log.Print("Dati di prova già presenti. Usa -reset per ricrearli.")
		return
	}

	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()

	if seedUsers > 0 {
		if err := deleteSeedData(tx); err != nil {
			log.Fatalf("Eliminazione dei dati di prova fallita: %v", err)
		}
	}
	if err := insertSeedData(tx); err != nil {
		log.Fatalf("Inserimento dei dati di prova fallito: %v", err)
	}
	if err := tx.Commit(); err != nil {
		log.Fatal(err)
	}

	log.Printf("Inseriti %d utenti, %d annunci e %d conversazioni.", len(users), len(listings), len(conversations))
	log.Printf("Accedi con una di queste email e password %q:", seedPassword)
	for _, u := range users {
		visibility := ""
		if !u.public {
			visibility = " (profilo privato)"
		}
		log.Printf("  %s%s — %s%s", u.key, seedDomain, u.userType, visibility)
	}
}

func deleteSeedData(tx *sql.Tx) error {
	seedIDs := `SELECT id FROM roomdate_app.users WHERE email LIKE $1`
	statements := []string{
		// message_keys e conversation_participants spariscono a cascata
		`DELETE FROM roomdate_app.messages WHERE conversation_id IN (
             SELECT c.id FROM roomdate_app.conversations c
             LEFT JOIN roomdate_app.listings l ON c.listing_id = l.id
             WHERE c.tenant_id IN (` + seedIDs + `) OR c.user2_id IN (` + seedIDs + `) OR l.user_id IN (` + seedIDs + `))`,
		`DELETE FROM roomdate_app.conversations WHERE tenant_id IN (` + seedIDs + `) OR user2_id IN (` + seedIDs + `)
             OR listing_id IN (SELECT id FROM roomdate_app.listings WHERE user_id IN (` + seedIDs + `))`,
		`DELETE FROM roomdate_app.listings WHERE user_id IN (` + seedIDs + `)`,
		`DELETE FROM roomdate_app.users WHERE email LIKE $1`,
	}
	for _, s := range statements {
		if _, err := tx.Exec(s, seedEmailPattern); err != nil {
			return err
		}
	}
	return nil
}

func insertSeedData(tx *sql.Tx) error {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(seedPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	keys := map[string]*userKeys{}
	for _, u := range users {
		k, err := newUserKeys(seedPassword)
		if err != nil {
			return fmt.Errorf("chiavi per %s: %w", u.key, err)
		}
		err = tx.QueryRow(`
            INSERT INTO roomdate_app.users
                (first_name, last_name, email, password_hash, citta, user_type, birthdate, budget_max,
                 occupation, bio, lifestyle_tags, is_public, public_key, encrypted_private_key, crypto_salt, crypto_iv)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING id::text`,
			u.nome, u.cognome, u.key+seedDomain, string(passwordHash), u.citta, u.userType, u.nascita, u.budget,
			u.occupation, u.bio, u.tags, u.public, k.publicB64, k.vault, k.cryptoSalt, k.cryptoIv,
		).Scan(&k.id)
		if err != nil {
			return fmt.Errorf("utente %s: %w", u.key, err)
		}
		keys[u.key] = k
	}

	listingIDs := make([]string, len(listings))
	for i, l := range listings {
		err := tx.QueryRow(`
            INSERT INTO roomdate_app.listings
                (user_id, title, city, zone, room_type, price, description, created_at,
                 amenities, bills_included, available_from)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - make_interval(days => $8),
                    $9, $10, CASE WHEN $11::int > 0 THEN CURRENT_DATE + $11::int END)
            RETURNING id::text`,
			keys[l.owner].id, l.title, l.city, l.zone, l.roomType, l.price, l.description, l.daysAgo,
			l.amenities, l.billsIncluded, l.availableInDays,
		).Scan(&listingIDs[i])
		if err != nil {
			return fmt.Errorf("annuncio %q: %w", l.title, err)
		}
	}

	for _, c := range conversations {
		var listingID, user2ID any
		recipientOf := map[string]string{}
		if c.listing >= 0 {
			listingID = listingIDs[c.listing]
			owner := listings[c.listing].owner
			// Nelle chat su un annuncio user2_id è il proprietario
			user2ID = keys[owner].id
			recipientOf[c.tenant], recipientOf[owner] = owner, c.tenant
		} else {
			user2ID = keys[c.user2].id
			recipientOf[c.tenant], recipientOf[c.user2] = c.user2, c.tenant
		}

		tenantID := keys[c.tenant].id
		otherID, _ := user2ID.(string)
		dedupKey := "direct:" + min(tenantID, otherID) + ":" + max(tenantID, otherID)
		if c.listing >= 0 {
			dedupKey = fmt.Sprintf("listing:%v:%s", listingID, tenantID)
		}

		var conversationID string
		err := tx.QueryRow(`
            INSERT INTO roomdate_app.conversations (listing_id, tenant_id, user2_id, dedup_key)
            VALUES ($1, $2, $3, $4) RETURNING id::text`,
			listingID, tenantID, user2ID, dedupKey,
		).Scan(&conversationID)
		if err != nil {
			return fmt.Errorf("conversazione di %s: %w", c.tenant, err)
		}
		for _, id := range []string{tenantID, otherID} {
			_, err = tx.Exec(`
                INSERT INTO roomdate_app.conversation_participants (conversation_id, user_id)
                VALUES ($1, $2)`, conversationID, id)
			if err != nil {
				return fmt.Errorf("partecipante di %s: %w", c.tenant, err)
			}
		}

		for _, m := range c.messages {
			// Cifratura ibrida, come nel browser: un solo testo cifrato con AES-GCM e la chiave
			// del messaggio cifrata con RSA per ogni partecipante.
			body, iv, messageKey, err := encryptBody(m.text)
			if err != nil {
				return fmt.Errorf("messaggio %q: %w", m.text, err)
			}
			var messageID string
			err = tx.QueryRow(`
                INSERT INTO roomdate_app.messages (conversation_id, sender_id, format, body, iv, content, created_at)
                VALUES ($1, $2, 2, $3, $4, '', NOW() - make_interval(mins => $5))
                RETURNING id::text`,
				conversationID, keys[m.from].id, body, iv, m.minutesAgo,
			).Scan(&messageID)
			if err != nil {
				return fmt.Errorf("messaggio %q: %w", m.text, err)
			}
			for _, participant := range []*userKeys{keys[m.from], keys[recipientOf[m.from]]} {
				wrapped, err := encryptFor(participant.publicKey, string(messageKey))
				if err != nil {
					return fmt.Errorf("chiave del messaggio %q: %w", m.text, err)
				}
				_, err = tx.Exec(`
                    INSERT INTO roomdate_app.message_keys (message_id, user_id, wrapped_key)
                    VALUES ($1, $2, $3)`, messageID, participant.id, wrapped)
				if err != nil {
					return fmt.Errorf("chiave del messaggio %q: %w", m.text, err)
				}
			}
		}
	}
	return nil
}

// newUserKeys replica generateKeyPair + wrapPrivateKey di src/utils/crypto.js:
// chiave privata PKCS#8 in Base64, cifrata con AES-256-GCM e chiave derivata con PBKDF2-SHA256.
func newUserKeys(password string) (*userKeys, error) {
	priv, err := rsa.GenerateKey(rand.Reader, rsaBits)
	if err != nil {
		return nil, err
	}
	pkcs8, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		return nil, err
	}
	spki, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		return nil, err
	}

	salt := make([]byte, 16)
	iv := make([]byte, 12)
	rand.Read(salt)
	rand.Read(iv)

	aesKey, err := pbkdf2.Key(sha256.New, password, salt, pbkdf2Iterations, 32)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	// Come WebCrypto: testo cifrato seguito dal tag di autenticazione
	sealed := gcm.Seal(nil, iv, []byte(base64.StdEncoding.EncodeToString(pkcs8)), nil)

	b64 := base64.StdEncoding.EncodeToString
	return &userKeys{
		publicKey:  &priv.PublicKey,
		publicB64:  b64(spki),
		vault:      b64(sealed),
		cryptoSalt: b64(salt),
		cryptoIv:   b64(iv),
	}, nil
}

// encryptBody cifra il testo con AES-256-GCM, come encryptForRecipients di src/utils/crypto.js:
// restituisce testo cifrato e IV in Base64, più la chiave del messaggio da cifrare per i partecipanti.
func encryptBody(text string) (body, iv string, messageKey []byte, err error) {
	messageKey = make([]byte, 32)
	nonce := make([]byte, 12)
	rand.Read(messageKey)
	rand.Read(nonce)

	block, err := aes.NewCipher(messageKey)
	if err != nil {
		return "", "", nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", nil, err
	}
	b64 := base64.StdEncoding.EncodeToString
	return b64(gcm.Seal(nil, nonce, []byte(text), nil)), b64(nonce), messageKey, nil
}

// encryptFor replica encryptMessage di src/utils/crypto.js (RSA-OAEP con SHA-256).
func encryptFor(pub *rsa.PublicKey, text string) (string, error) {
	ciphertext, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, pub, []byte(text), nil)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}
