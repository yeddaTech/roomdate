// src/utils/crypto.js

// 1. Genera la coppia di chiavi RSA
export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048, // Lunghezza standard sicura
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // Le chiavi sono esportabili
    ["encrypt", "decrypt"]
  );

  // Esporta le chiavi in formati standard
  const publicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  // Converti i buffer in stringhe Base64 per poterle salvare su database/inviare via JSON
  return {
    publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
    privateKey: btoa(String.fromCharCode(...new Uint8Array(privateKey)))
  };
}

// --- CHIAVI DELL'ACCOUNT (modulo M3.4) ---
//
// Dalla password il browser ricava due chiavi diverse:
// - authKey va al server e serve solo all'accesso (il server la ri-cifra con Argon2id);
// - wrapKey non esce mai dal browser e cifra la chiave privata delle chat.
// Così chi gestisce il server non può aprire la chiave privata, perché non riceve mai la password.

/** Ripetizioni di PBKDF2-SHA256 per le nuove password (raccomandazione OWASP). */
export const KDF_ITERATIONS = 600000;

/** Sale casuale per un nuovo calcolo delle chiavi (16 byte in Base64). */
export function newKdfSalt() {
  return toBase64(window.crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * Ricava le due chiavi dell'account dalla password.
 * PBKDF2-SHA256 produce una chiave madre; HKDF ne ricava due indipendenti con etichette diverse,
 * così conoscere una non aiuta a indovinare l'altra.
 *
 * @returns {Promise<{authKey: string, wrapKey: CryptoKey}>} authKey in Base64; wrapKey non estraibile.
 */
export async function deriveAccountKeys(password, saltBase64, iterations) {
  const passwordKey = await window.crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const master = await window.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: base64ToArrayBuffer(saltBase64), iterations, hash: "SHA-256" },
    passwordKey,
    256
  );
  const masterKey = await window.crypto.subtle.importKey("raw", master, { name: "HKDF" }, false, ["deriveBits", "deriveKey"]);
  const hkdf = (label) => ({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode(label) });

  const authKey = await window.crypto.subtle.deriveBits(hkdf("roomdate-auth"), masterKey, 256);
  const wrapKey = await window.crypto.subtle.deriveKey(
    hkdf("roomdate-wrap"), masterKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
  return { authKey: toBase64(authKey), wrapKey };
}

/** Cifra la chiave privata (PKCS#8 in Base64) con la wrapKey. */
export async function wrapPrivateKeyWith(privateKeyBase64, wrapKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, wrapKey, new TextEncoder().encode(privateKeyBase64)
  );
  return { encryptedPrivateKey: toBase64(encrypted), cryptoIv: toBase64(iv) };
}

/** Decifra la chiave privata con la wrapKey e la restituisce in PKCS#8 Base64 (serve per cifrarla di nuovo). */
export async function unwrapPrivateKeyWith(encryptedPrivateKey, ivBase64, wrapKey) {
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(ivBase64)) }, wrapKey, base64ToArrayBuffer(encryptedPrivateKey)
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Importa la chiave privata come CryptoKey non estraibile: il browser la usa per decifrare,
 * ma nessuno script può più leggerne il contenuto (vulnerabilità S15).
 */
export async function importPrivateKey(privateKeyBase64) {
  return window.crypto.subtle.importKey(
    "pkcs8", base64ToArrayBuffer(privateKeyBase64), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]
  );
}

// --- VERSIONE PRECEDENTE (account non ancora aggiornati) ---

// 2. Deriva una chiave AES sicura dalla password dell'utente
async function deriveKeyFromPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// 3. Apre una chiave privata cifrata con la versione precedente (PBKDF2 a 100.000 ripetizioni sulla
// password): serve solo a portare gli account vecchi al metodo nuovo.
export async function unwrapPrivateKey(encryptedPrivateKeyBase64, password, saltBase64, ivBase64) {
  try {
    const salt = new Uint8Array(atob(saltBase64).split('').map(c => c.charCodeAt(0)));
    const iv = new Uint8Array(atob(ivBase64).split('').map(c => c.charCodeAt(0)));
    const encryptedBuffer = new Uint8Array(atob(encryptedPrivateKeyBase64).split('').map(c => c.charCodeAt(0)));

    const aesKey = await deriveKeyFromPassword(password, salt);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      encryptedBuffer
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (error) {
    console.error("Errore decrittografia (Password errata o dati corrotti):", error);
    throw new Error("Impossibile decifrare la chiave privata");
  }
}

// --- FUNZIONI DI SUPPORTO ---
// Trasforma una stringa Base64 in un ArrayBuffer (necessario per le API crittografiche)
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Trasforma dati binari in Base64, a blocchi: con un messaggio lungo l'intero array
// come argomenti di una sola chiamata supererebbe il limite dello stack.
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

// Cifra dati binari con la chiave pubblica RSA di un utente.
async function encryptBytes(data, publicKeyBase64) {
  const publicKey = await window.crypto.subtle.importKey(
    "spki", base64ToArrayBuffer(publicKeyBase64), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]
  );
  return toBase64(await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, data));
}

// Decifra dati binari con la propria chiave privata RSA (una CryptoKey non estraibile).
async function decryptBytes(encryptedBase64, privateKey) {
  return window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, base64ToArrayBuffer(encryptedBase64));
}

/**
 * Cifra un messaggio in chiaro usando la chiave PUBBLICA in Base64 del destinatario.
 * @param {string} text - Il messaggio in chiaro.
 * @param {string} publicKeyBase64 - La chiave pubblica in Base64.
 * @returns {Promise<string>} - Il messaggio cifrato in formato Base64.
 */
export async function encryptMessage(text, publicKeyBase64) {
  return encryptBytes(new TextEncoder().encode(text), publicKeyBase64);
}

/**
 * Cifra un messaggio per più destinatari (cifratura ibrida).
 *
 * Il testo viene cifrato una sola volta con AES-256-GCM; la chiave del messaggio viene poi cifrata
 * con RSA-OAEP per ogni partecipante. Così la lunghezza del messaggio non dipende più da RSA,
 * che si ferma a 190 byte (anomalia F8).
 *
 * @param {string} text - Il messaggio in chiaro.
 * @param {Array<{userId: string, publicKey: string}>} recipients - Partecipanti con chiave pubblica.
 * @returns {Promise<{body: string, iv: string, keys: Array<{userId: string, key: string}>}>}
 */
export async function encryptForRecipients(text, recipients) {
  const messageKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    messageKey,
    new TextEncoder().encode(text)
  );
  const rawKey = await window.crypto.subtle.exportKey("raw", messageKey);

  const keys = [];
  for (const recipient of recipients) {
    keys.push({ userId: recipient.userId, key: await encryptBytes(rawKey, recipient.publicKey) });
  }
  return { body: toBase64(encrypted), iv: toBase64(iv), keys };
}

/**
 * Decifra un messaggio in cifratura ibrida: prima la chiave del messaggio con RSA, poi il testo.
 *
 * @param {{body: string, iv: string, key: string}} message - Testo cifrato, IV e chiave per chi legge.
 * @param {CryptoKey} privateKey - La chiave privata dell'utente.
 */
export async function decryptFromRecipients({ body, iv, key }, privateKey) {
  const rawKey = await decryptBytes(key, privateKey);
  const messageKey = await window.crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(iv)) },
    messageKey,
    base64ToArrayBuffer(body)
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Decifra un messaggio vecchio (formato 1, cifrato direttamente con RSA).
 * @param {string} encryptedBase64 - Il messaggio cifrato in Base64.
 * @param {CryptoKey} privateKey - La chiave privata dell'utente.
 * @returns {Promise<string>} - Il messaggio decifrato in chiaro.
 */
export async function decryptMessage(encryptedBase64, privateKey) {
  return new TextDecoder().decode(await decryptBytes(encryptedBase64, privateKey));
}