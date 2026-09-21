// Accesso, registrazione e cambio password con le chiavi ricavate nel browser (modulo M3.4).
//
// La password non lascia mai il browser: da essa si ricavano una chiave d'accesso, inviata al server,
// e una chiave che cifra la chiave privata delle chat e resta qui. Gli account creati prima passano
// al metodo nuovo da soli, al primo accesso.
import {
  login as apiLogin,
  prelogin,
  recoveryComplete,
  recoveryStart,
  recoveryVerify,
  setRecoveryKey,
  upgradeKdf,
  type LoginResult,
} from '../api/auth';
import { ApiError } from '../api/client';
import type { CryptoKeys, KdfParams, RecoveryInput, WrappedPrivateKey } from '../api/types';
import {
  deriveAccountKeys,
  deriveRecoveryKeys,
  generateKeyPair,
  KDF_ITERATIONS,
  newKdfSalt,
  newRecoveryCode,
  normalizeRecoveryCode,
  unwrapPrivateKey,
  unwrapPrivateKeyWith,
  wrapPrivateKeyWith,
} from '../utils/crypto';
import { hasStoredVault, readPrivateKeyWithPassword, saveVault, storeKeysAtLogin } from './keyStorage';

/** Parametri nuovi, con un sale casuale. */
function newKdf(): KdfParams {
  return { version: 2, salt: newKdfSalt(), iterations: KDF_ITERATIONS };
}

/** Cifra la chiave privata con la chiave ricavata dalla password; il sale va con il vault. */
async function wrapWith(privateKeyBase64: string, wrapKey: CryptoKey, kdf: KdfParams): Promise<WrappedPrivateKey> {
  const wrapped = await wrapPrivateKeyWith(privateKeyBase64, wrapKey);
  return { encryptedPrivateKey: wrapped.encryptedPrivateKey, cryptoIv: wrapped.cryptoIv, cryptoSalt: kdf.salt };
}

export interface SignInResult extends LoginResult {
  /** false se l'accesso è riuscito ma la chiave privata non si è aperta. */
  keysUnlocked: boolean;
}

/** Accede con email e password. */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const kdf = await prelogin(email);

  if (kdf.version === 2) {
    const { authKey, wrapKey } = await deriveAccountKeys(password, kdf.salt, kdf.iterations);
    const result = await apiLogin(email, authKey);
    const keysUnlocked = await storeKeysAtLogin(result.keys, kdf, { wrapKey });
    return { ...result, keysUnlocked };
  }

  // Account creato prima del metodo nuovo: si accede come prima, poi lo si aggiorna subito
  const result = await apiLogin(email, password);
  const upgraded = await upgradeAccount(password, result.keys);
  if (upgraded) return { ...result, keys: upgraded.keys, keysUnlocked: upgraded.keysUnlocked };

  // Aggiornamento non riuscito (es. rete): l'accesso vale lo stesso, si riproverà al prossimo
  const keysUnlocked = await storeKeysAtLogin(result.keys, { version: 1, salt: '', iterations: 0 }, { legacyPassword: password });
  return { ...result, keysUnlocked };
}

/**
 * Porta un account vecchio al metodo nuovo: ricava le chiavi dalla password con un sale nuovo,
 * cifra di nuovo la chiave privata e lo comunica al server in un'unica operazione.
 */
async function upgradeAccount(
  password: string,
  keys: CryptoKeys | null,
): Promise<{ keys: CryptoKeys | null; keysUnlocked: boolean } | null> {
  const kdf = newKdf();
  const { authKey, wrapKey } = await deriveAccountKeys(password, kdf.salt, kdf.iterations);

  let wrapped: WrappedPrivateKey | null = null;
  if (keys) {
    let privateKeyBase64: string;
    try {
      privateKeyBase64 = await unwrapPrivateKey(keys.encryptedPrivateKey, password, keys.cryptoSalt, keys.cryptoIv);
    } catch {
      // La chiave salvata non si apre con questa password: meglio non toccarla
      return null;
    }
    wrapped = await wrapWith(privateKeyBase64, wrapKey, kdf);
  }

  try {
    await upgradeKdf({ currentPassword: password, authKey, kdf, keys: wrapped });
  } catch {
    return null;
  }

  const newKeys = keys && wrapped ? { publicKey: keys.publicKey, ...wrapped } : null;
  const keysUnlocked = await storeKeysAtLogin(newKeys, kdf, { wrapKey });
  return { keys: newKeys, keysUnlocked };
}

/**
 * Nuova chiave di recupero: il codice da mostrare all'utente e ciò che va al server
 * (sale, chiave di verifica e copia della chiave privata cifrata con il codice).
 */
async function createRecovery(privateKeyBase64: string | null): Promise<{ code: string; recovery: RecoveryInput }> {
  const code = newRecoveryCode();
  const salt = newKdfSalt();
  const { authKey, wrapKey } = await deriveRecoveryKeys(normalizeRecoveryCode(code), salt);
  const copy = privateKeyBase64 ? await wrapPrivateKeyWith(privateKeyBase64, wrapKey) : null;
  return {
    code,
    recovery: { salt, authKey, encryptedPrivateKey: copy?.encryptedPrivateKey ?? '', iv: copy?.cryptoIv ?? '' },
  };
}

export interface PreparedRegistration {
  authKey: string;
  kdf: KdfParams;
  keys: CryptoKeys;
  recovery: RecoveryInput;
  /** Codice di recupero da mostrare una sola volta, dopo la registrazione. */
  recoveryCode: string;
}

/** Dati di registrazione ricavati dalla password: chiave d'accesso, chiavi della chat e chiave di recupero. */
export async function prepareRegistration(password: string): Promise<PreparedRegistration> {
  const kdf = newKdf();
  const pair = await generateKeyPair();
  const { authKey, wrapKey } = await deriveAccountKeys(password, kdf.salt, kdf.iterations);
  const wrapped = await wrapWith(pair.privateKey, wrapKey, kdf);
  const { code, recovery } = await createRecovery(pair.privateKey);
  return { authKey, kdf, keys: { publicKey: pair.publicKey, ...wrapped }, recovery, recoveryCode: code };
}

/**
 * Crea o sostituisce la chiave di recupero di un account già registrato. Serve la password,
 * per dimostrarla al server e per aprire la chiave privata da copiare. Restituisce il codice
 * da mostrare, o null se la password non apre la chiave salvata su questo dispositivo.
 */
export async function setupRecoveryKey(email: string, password: string): Promise<string | null> {
  const current = await prelogin(email);
  const secret = current.version === 2
    ? (await deriveAccountKeys(password, current.salt, current.iterations)).authKey
    : password;

  const privateKeyBase64 = await readPrivateKeyWithPassword(password);
  if (privateKeyBase64 === null && hasStoredVault()) return null;

  const { code, recovery } = await createRecovery(privateKeyBase64);
  await setRecoveryKey(secret, recovery);
  return code;
}

/**
 * Password dimenticata: con l'email e il codice di recupero imposta una password nuova.
 * La chiave privata si apre con il codice e si cifra di nuovo con la nuova password,
 * quindi i messaggi restano leggibili.
 */
export async function recoverAccount(email: string, code: string, newPassword: string): Promise<void> {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) {
    throw new ApiError(400, 'invalid_recovery_code', 'Il codice di recupero non è valido: controlla di averlo copiato per intero.');
  }

  const salt = await recoveryStart(email);
  const recoveryKeys = await deriveRecoveryKeys(normalized, salt);
  const copy = await recoveryVerify(email, recoveryKeys.authKey);

  const kdf = newKdf();
  const { authKey, wrapKey } = await deriveAccountKeys(newPassword, kdf.salt, kdf.iterations);
  let keys: WrappedPrivateKey | null = null;
  if (copy) {
    const privateKeyBase64 = await unwrapPrivateKeyWith(copy.encryptedPrivateKey, copy.iv, recoveryKeys.wrapKey);
    keys = await wrapWith(privateKeyBase64, wrapKey, kdf);
  }
  await recoveryComplete({ email, recoveryKey: recoveryKeys.authKey, newPassword: authKey, kdf, keys });
}

export type PreparedPasswordChange =
  | {
      ok: true;
      currentPassword: string;
      newPassword: string;
      kdf: KdfParams;
      keys: WrappedPrivateKey | null;
      /** Da chiamare dopo che il server ha confermato il cambio. */
      commit: () => void;
    }
  | { ok: false };

/**
 * Prepara un cambio password: ricava la chiave d'accesso attuale e quella nuova, e cifra di nuovo
 * la chiave privata con la nuova password. ok è false se la password attuale non apre la chiave
 * salvata su questo dispositivo.
 */
export async function preparePasswordChange(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<PreparedPasswordChange> {
  const current = await prelogin(email);
  const currentSecret = current.version === 2
    ? (await deriveAccountKeys(currentPassword, current.salt, current.iterations)).authKey
    : currentPassword;

  const kdf = newKdf();
  const { authKey, wrapKey } = await deriveAccountKeys(newPassword, kdf.salt, kdf.iterations);

  const privateKeyBase64 = await readPrivateKeyWithPassword(currentPassword);
  // Il vault c'è ma la password non lo apre: password sbagliata o chiavi di un altro account
  if (privateKeyBase64 === null && hasStoredVault()) return { ok: false };

  const keys = privateKeyBase64 !== null ? await wrapWith(privateKeyBase64, wrapKey, kdf) : null;
  return {
    ok: true,
    currentPassword: currentSecret,
    newPassword: authKey,
    kdf,
    keys,
    commit: () => {
      if (keys) saveVault(keys, kdf);
    },
  };
}
