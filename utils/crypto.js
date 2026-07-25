// src/utils/crypto.js

// 1. Deriva una chiave AES sicura dalla password dell'utente
async function deriveKeyFromPassword(password, salt) {
  const enc = new TextEncoder();
  // Importa la password come materiale grezzo
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
  );

  // Usa PBKDF2 con 100.000 iterazioni (standard di sicurezza) per creare la chiave AES
  return window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// 2. "Incarta" la Chiave Privata appena generata
export async function wrapPrivateKey(privateKeyString, password) {
  // Genera Sale (Salt) e Vettore di Inizializzazione (IV) casuali
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Crea la chiave AES dalla password
  const aesKey = await deriveKeyFromPassword(password, salt);
  
  // Cifra la chiave privata
  const enc = new TextEncoder();
  const encryptedPrivateKeyBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    enc.encode(privateKeyString)
  );

  // Ritorna il pacchetto completo, convertendo i buffer in stringhe Base64 
  // così possiamo inviarli facilmente tramite JSON al backend Go
  return {
    encryptedPrivateKey: btoa(String.fromCharCode(...new Uint8Array(encryptedPrivateKeyBuffer))),
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv))
  };
}

// 3. "Spacchetta" la Chiave Privata al momento del Login
export async function unwrapPrivateKey(encryptedPrivateKeyBase64, password, saltBase64, ivBase64) {
  try {
    // 1. Converti le stringhe Base64 in array di byte (Uint8Array)
    const salt = new Uint8Array(atob(saltBase64).split('').map(c => c.charCodeAt(0)));
    const iv = new Uint8Array(atob(ivBase64).split('').map(c => c.charCodeAt(0)));
    const encryptedBuffer = new Uint8Array(atob(encryptedPrivateKeyBase64).split('').map(c => c.charCodeAt(0)));

    // 2. Ricrea la chiave AES partendo dalla password digitata e dal "sale" salvato su Neon
    const aesKey = await deriveKeyFromPassword(password, salt);

    // 3. Decifra la chiave privata (Apre la cassaforte)
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      encryptedBuffer
    );

    // 4. Trasforma i byte decifrati di nuovo in testo
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (error) {
    console.error("Errore decrittografia (Password errata o dati corrotti):", error);
    throw new Error("Impossibile decifrare la chiave privata");
  }
}