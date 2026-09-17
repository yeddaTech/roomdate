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

// 3. "Incarta" la Chiave Privata appena generata
export async function wrapPrivateKey(privateKeyString, password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const aesKey = await deriveKeyFromPassword(password, salt);
  
  const enc = new TextEncoder();
  const encryptedPrivateKeyBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    enc.encode(privateKeyString)
  );

  return {
    encryptedPrivateKey: btoa(String.fromCharCode(...new Uint8Array(encryptedPrivateKeyBuffer))),
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv))
  };
}

// 4. "Spacchetta" la Chiave Privata al momento del Login
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

// 5. Cifra di nuovo la Chiave Privata con una nuova password (cambio password).
// Restituisce null se la password attuale non apre la chiave salvata,
// o se la chiave non corrisponde alla chiave pubblica dell'utente (dati locali di un altro account).
export async function rewrapPrivateKey(cryptoData, currentPassword, newPassword, publicKeyBase64) {
  if (!cryptoData || !publicKeyBase64) return null;

  let privateKey;
  try {
    privateKey = await unwrapPrivateKey(
      cryptoData.encryptedPrivateKey,
      currentPassword,
      cryptoData.cryptoSalt,
      cryptoData.cryptoIv
    );
    const probe = await encryptMessage('roomdate-key-check', publicKeyBase64);
    if (await decryptMessage(probe, privateKey) !== 'roomdate-key-check') return null;
  } catch {
    return null;
  }

  return wrapPrivateKey(privateKey, newPassword);
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

// Decifra dati binari con la propria chiave privata RSA.
async function decryptBytes(encryptedBase64, privateKeyBase64) {
  const privateKey = await window.crypto.subtle.importKey(
    "pkcs8", base64ToArrayBuffer(privateKeyBase64), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]
  );
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
 * @param {string} privateKeyBase64 - La chiave privata dell'utente.
 */
export async function decryptFromRecipients({ body, iv, key }, privateKeyBase64) {
  const rawKey = await decryptBytes(key, privateKeyBase64);
  const messageKey = await window.crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(iv)) },
    messageKey,
    base64ToArrayBuffer(body)
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Decifra un messaggio cifrato usando la tua chiave PRIVATA in Base64.
 * @param {string} encryptedBase64 - Il messaggio cifrato in Base64.
 * @param {string} privateKeyBase64 - La chiave privata decriptata in Base64.
 * @returns {Promise<string>} - Il messaggio decifrato in chiaro.
 */
export async function decryptMessage(encryptedBase64, privateKeyBase64) {
  return new TextDecoder().decode(await decryptBytes(encryptedBase64, privateKeyBase64));
}