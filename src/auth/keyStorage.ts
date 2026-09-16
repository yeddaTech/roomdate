// Chiavi E2EE conservate nel browser (il sistema verrà rivisto nel modulo M3.4):
// - localStorage: chiave privata cifrata con la password dell'utente e chiave pubblica
// - sessionStorage: chiave privata decifrata, valida finché la scheda resta aperta
import type { CryptoKeys, WrappedPrivateKey } from '../api/types';
import { rewrapPrivateKey, unwrapPrivateKey } from '../utils/crypto';

const VAULT_KEY = 'roomdate_crypto';
const PUBLIC_KEY = 'roomdate_public_key';
const PRIVATE_KEY = 'roomdate_private_key';
// Copia dell'utente salvata dalle versioni precedenti dell'app: non più usata, solo da rimuovere
const LEGACY_USER_KEY = 'roomdate_user';

// Lo storage può non essere disponibile (es. navigazione privata con restrizioni)
function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // niente da fare: l'utente dovrà sbloccare la chat a ogni visita
  }
}

function readVault(): WrappedPrivateKey | null {
  const raw = read(localStorage, VAULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WrappedPrivateKey;
  } catch {
    return null;
  }
}

function writeVault(vault: WrappedPrivateKey | null): void {
  write(localStorage, VAULT_KEY, vault ? JSON.stringify(vault) : null);
}

/** Indica se su questo dispositivo c'è la chiave privata cifrata (salvata all'ultimo accesso). */
export function hasStoredVault(): boolean {
  return readVault() !== null;
}

export function getPublicKey(): string | null {
  return read(localStorage, PUBLIC_KEY);
}

export function getPrivateKey(): string | null {
  return read(sessionStorage, PRIVATE_KEY);
}

/**
 * Salva le chiavi ricevute al login e decifra la chiave privata con la password.
 * Restituisce false se la chiave non si apre (l'accesso resta valido, ma la chat andrà sbloccata).
 */
export async function storeKeysAtLogin(keys: CryptoKeys | null, password: string): Promise<boolean> {
  if (!keys) {
    // Account senza chiavi: non lasciare quelle di un accesso precedente
    writeVault(null);
    write(localStorage, PUBLIC_KEY, null);
    write(sessionStorage, PRIVATE_KEY, null);
    return true;
  }

  const { publicKey, ...vault } = keys;
  writeVault(vault);
  write(localStorage, PUBLIC_KEY, publicKey);
  return unlockPrivateKey(password);
}

/** Decifra la chiave privata salvata con la password e la tiene per la sessione della scheda. */
export async function unlockPrivateKey(password: string): Promise<boolean> {
  const vault = readVault();
  if (!vault) return false;
  try {
    const privateKey = await unwrapPrivateKey(vault.encryptedPrivateKey, password, vault.cryptoSalt, vault.cryptoIv);
    write(sessionStorage, PRIVATE_KEY, privateKey);
    return true;
  } catch {
    return false;
  }
}

export type PasswordChangeKeys = { ok: true; keys: WrappedPrivateKey | null } | { ok: false };

/**
 * Prepara la chiave privata per un cambio password: la cifra di nuovo con la nuova password.
 * ok è false se la password attuale non apre la chiave o se le chiavi salvate non sono di questo account.
 * keys è null se su questo dispositivo non ci sono chiavi (il server le richiede se l'account le ha).
 */
export async function prepareKeysForPasswordChange(currentPassword: string, newPassword: string): Promise<PasswordChangeKeys> {
  const vault = readVault();
  if (!vault) return { ok: true, keys: null };

  const wrapped = await rewrapPrivateKey(vault, currentPassword, newPassword, getPublicKey());
  if (!wrapped) return { ok: false };
  return { ok: true, keys: { encryptedPrivateKey: wrapped.encryptedPrivateKey, cryptoSalt: wrapped.salt, cryptoIv: wrapped.iv } };
}

/** Salva la chiave privata cifrata con la nuova password, dopo un cambio password riuscito. */
export function saveKeysAfterPasswordChange(keys: WrappedPrivateKey): void {
  writeVault(keys);
}

/** Rimuove tutti i dati della sessione salvati nel browser. */
export function clearLocalSession(): void {
  writeVault(null);
  write(localStorage, PUBLIC_KEY, null);
  write(localStorage, LEGACY_USER_KEY, null);
  try {
    sessionStorage.clear();
  } catch {
    // storage non disponibile: non c'è nulla da pulire
  }
}
