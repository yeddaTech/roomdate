// Regole sulle password (linee guida NIST 800-63B): contano la lunghezza e l'imprevedibilità,
// non i simboli obbligatori. Dal modulo M3.4 la password non arriva più al server, quindi le
// controlla il browser. Stesse regole di PasswordProblem in internal/auth/password.go.
import commonPasswordsText from '../../shared/common_passwords.txt?raw';
import { MIN_PASSWORD_LENGTH } from '../api/auth';

const MAX_PASSWORD_BYTES = 128;

const commonPasswords = new Set(
  commonPasswordsText.split('\n').map((line) => line.trim()).filter(Boolean),
);

function isRepeatedCharacter(password: string): boolean {
  return [...password].every((character) => character === password[0]);
}

/** Sequenze crescenti o decrescenti come "1234567890" e "abcdefghij". */
function isSequence(password: string): boolean {
  const codes = [...password].map((character) => character.codePointAt(0) ?? 0);
  if (codes.length < 2) return false;
  const step = codes[1] - codes[0];
  if (step !== 1 && step !== -1) return false;
  return codes.every((code, i) => i === 0 || code - codes[i - 1] === step);
}

/** Messaggio da mostrare se la password non va bene, altrimenti null. */
export function passwordProblem(password: string, email: string, firstName: string): string | null {
  if ([...password].length < MIN_PASSWORD_LENGTH) {
    return `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return 'La password è troppo lunga';
  }

  const lower = password.toLowerCase();
  if (commonPasswords.has(lower)) {
    return 'Questa password è tra le più usate: scegline una meno prevedibile';
  }
  if (isRepeatedCharacter(lower) || isSequence(lower)) {
    return 'Questa password è troppo semplice: evita caratteri ripetuti o in sequenza';
  }

  const localPart = email.toLowerCase().split('@')[0];
  for (const personal of [localPart, firstName.toLowerCase()]) {
    if ([...personal].length >= 4 && lower.includes(personal)) {
      return 'La password non può contenere il tuo nome o la tua email';
    }
  }
  if (lower.includes('roomdate')) {
    return 'La password non può contenere il nome del sito';
  }
  return null;
}
