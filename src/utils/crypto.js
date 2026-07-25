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