// Chiavi E2EE conservate nel browser (modulo M3.4):
// - localStorage: la chiave privata cifrata con la wrapKey (il "vault"), con i parametri per ricavarla
//   di nuovo dalla password, e la chiave pubblica;
// - IndexedDB e memoria: la chiave privata aperta, come CryptoKey non estraibile. Il browser la usa per
//   decifrare, ma nessuno script può leggerne il contenuto (vulnerabilità S15). Resta dopo un ricaricamento
//   della pagina e viene cancellata all'uscita.
import type { CryptoKeys, KdfParams, WrappedPrivateKey } from '../api/types';
import { deriveAccountKeys, importPrivateKey, unwrapPrivateKey, unwrapPrivateKeyWith } from '../utils/crypto';

const VAULT_KEY = 'roomdate_crypto';
const PUBLIC_KEY = 'roomdate_public_key';
// Chiavi salvate dalle versioni precedenti dell'app: non più usate, solo da rimuovere
const LEGACY_PRIVATE_KEY = 'roomdate_private_key';
const LEGACY_USER_KEY = 'roomdate_user';

const DB_NAME = 'roomdate';
const DB_STORE = 'keys';
const PRIVATE_KEY_RECORD = 'privateKey';

/** Chiave privata cifrata, con i parametri che servono ad aprirla di nuovo con la password. */
interface StoredVault extends WrappedPrivateKey {
  kdf: KdfParams;
}

let privateKeyInMemory: CryptoKey | null = null;

// Lo storage può non essere disponibile (es. navigazione privata con restrizioni)
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // niente da fare: l'utente dovrà sbloccare la chat a ogni visita
  }
}

function readVault(): StoredVault | null {
  const raw = read(VAULT_KEY);
  if (!raw) return null;
  try {
    const vault = JSON.parse(raw) as StoredVault;
    // Vault salvato da una versione precedente, senza parametri: era cifrato con la password
    return vault.kdf ? vault : { ...vault, kdf: { version: 1, salt: '', iterations: 0 } };
  } catch {
    return null;
  }
}

function writeVault(vault: StoredVault | null): void {
  write(VAULT_KEY, vault ? JSON.stringify(vault) : null);
}

// --- IndexedDB: conserva la CryptoKey senza che il suo contenuto diventi mai leggibile ---

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await openDatabase();
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, mode);
      const request = run(transaction.objectStore(DB_STORE));
      transaction.oncomplete = () => {
        db.close();
        resolve(request.result ?? null);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch {
    // IndexedDB non disponibile: la chiave resta solo in memoria, fino alla chiusura della scheda
    return null;
  }
}

async function savePrivateKey(key: CryptoKey | null): Promise<void> {
  privateKeyInMemory = key;
  if (key) {
    await withStore('readwrite', (store) => store.put(key, PRIVATE_KEY_RECORD));
  } else {
    await withStore('readwrite', (store) => store.delete(PRIVATE_KEY_RECORD));
  }
}

// --- API usata dal resto dell'app ---

/** Indica se su questo dispositivo c'è la chiave privata cifrata (salvata all'ultimo accesso). */
export function hasStoredVault(): boolean {
  return readVault() !== null;
}

export function getPublicKey(): string | null {
  return read(PUBLIC_KEY);
}

/** Chiave privata aperta, o null se la chat è bloccata. */
export async function getPrivateKey(): Promise<CryptoKey | null> {
  if (privateKeyInMemory) return privateKeyInMemory;
  const stored = await withStore<CryptoKey>('readonly', (store) => store.get(PRIVATE_KEY_RECORD));
  privateKeyInMemory = stored instanceof CryptoKey ? stored : null;
  return privateKeyInMemory;
}

/**
 * Salva le chiavi ricevute all'accesso e apre la chiave privata.
 * wrapKey è la chiave ricavata dalla password (metodo nuovo); legacyPassword serve per i vault
 * cifrati con la versione precedente. Restituisce false se la chiave non si apre.
 */
export async function storeKeysAtLogin(
  keys: CryptoKeys | null,
  kdf: KdfParams,
  secret: { wrapKey: CryptoKey } | { legacyPassword: string },
): Promise<boolean> {
  // Resti di versioni precedenti: la chiave privata in chiaro non deve restare nel browser
  try {
    sessionStorage.removeItem(LEGACY_PRIVATE_KEY);
  } catch {
    // storage non disponibile: non c'è nulla da rimuovere
  }

  if (!keys) {
    // Account senza chiavi: non lasciare quelle di un accesso precedente
    writeVault(null);
    write(PUBLIC_KEY, null);
    await savePrivateKey(null);
    return true;
  }

  const { publicKey, ...wrapped } = keys;
  writeVault({ ...wrapped, kdf });
  write(PUBLIC_KEY, publicKey);

  try {
    const privateKeyBase64 = 'wrapKey' in secret
      ? await unwrapPrivateKeyWith(wrapped.encryptedPrivateKey, wrapped.cryptoIv, secret.wrapKey)
      : await unwrapPrivateKey(wrapped.encryptedPrivateKey, secret.legacyPassword, wrapped.cryptoSalt, wrapped.cryptoIv);
    await savePrivateKey(await importPrivateKey(privateKeyBase64));
    return true;
  } catch {
    await savePrivateKey(null);
    return false;
  }
}

/**
 * Apre la chiave privata salvata con la password (sblocco della chat su questo dispositivo).
 * Restituisce false se la password non la apre.
 */
export async function unlockPrivateKey(password: string): Promise<boolean> {
  const vault = readVault();
  if (!vault) return false;
  try {
    const privateKeyBase64 = await openVault(vault, password);
    await savePrivateKey(await importPrivateKey(privateKeyBase64));
    return true;
  } catch {
    return false;
  }
}

/** Decifra il vault con la password, con il metodo con cui è stato cifrato. */
async function openVault(vault: StoredVault, password: string): Promise<string> {
  if (vault.kdf.version === 2) {
    const { wrapKey } = await deriveAccountKeys(password, vault.kdf.salt, vault.kdf.iterations);
    return unwrapPrivateKeyWith(vault.encryptedPrivateKey, vault.cryptoIv, wrapKey);
  }
  return unwrapPrivateKey(vault.encryptedPrivateKey, password, vault.cryptoSalt, vault.cryptoIv);
}

/**
 * Chiave privata in chiaro (PKCS#8 Base64) decifrata con la password, per cifrarla di nuovo
 * con una password nuova. null se su questo dispositivo non c'è il vault o la password non lo apre.
 */
export async function readPrivateKeyWithPassword(password: string): Promise<string | null> {
  const vault = readVault();
  if (!vault) return null;
  try {
    return await openVault(vault, password);
  } catch {
    return null;
  }
}

/** Salva il vault cifrato con la nuova password, dopo un cambio password o un aggiornamento riuscito. */
export function saveVault(keys: WrappedPrivateKey, kdf: KdfParams): void {
  writeVault({ ...keys, kdf });
}

/** Rimuove tutti i dati della sessione salvati nel browser, compresa la chiave privata. */
export async function clearLocalSession(): Promise<void> {
  writeVault(null);
  write(PUBLIC_KEY, null);
  write(LEGACY_USER_KEY, null);
  try {
    sessionStorage.clear();
  } catch {
    // storage non disponibile: non c'è nulla da pulire
  }
  await savePrivateKey(null);
}
