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

// --- FUNZIONE DI SUPPORTO ---
// Trasforma una stringa Base64 in un ArrayBuffer (necessario per le API crittografiche)
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Cifra un messaggio in chiaro usando la chiave PUBBLICA in Base64 del destinatario.
 * @param {string} text - Il messaggio in chiaro.
 * @param {string} publicKeyBase64 - La chiave pubblica in Base64.
 * @returns {Promise<string>} - Il messaggio cifrato in formato Base64.
 */
export async function encryptMessage(text, publicKeyBase64) {
  // 1. Convertiamo la stringa Base64 della chiave pubblica in un oggetto CryptoKey
  const keyBuffer = base64ToArrayBuffer(publicKeyBase64);
  const cryptoPublicKey = await window.crypto.subtle.importKey(
    "spki",
    keyBuffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );

  // 2. Cifriamo il messaggio
  const encoder = new TextEncoder();
  const encodedText = encoder.encode(text);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    cryptoPublicKey,
    encodedText
  );

  // 3. Ritorniamo il messaggio cifrato in Base64
  const encryptedArray = Array.from(new Uint8Array(encryptedBuffer));
  return btoa(String.fromCharCode.apply(null, encryptedArray));
}

/**
 * Decifra un messaggio cifrato usando la tua chiave PRIVATA in Base64.
 * @param {string} encryptedBase64 - Il messaggio cifrato in Base64.
 * @param {string} privateKeyBase64 - La chiave privata decriptata in Base64.
 * @returns {Promise<string>} - Il messaggio decifrato in chiaro.
 */
export async function decryptMessage(encryptedBase64, privateKeyBase64) {
  // 1. Convertiamo la stringa Base64 della chiave privata in un oggetto CryptoKey
  const keyBuffer = base64ToArrayBuffer(privateKeyBase64);
  const cryptoPrivateKey = await window.crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );

  // 2. Decifriamo il messaggio
  const encryptedBuffer = base64ToArrayBuffer(encryptedBase64);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    cryptoPrivateKey,
    encryptedBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}