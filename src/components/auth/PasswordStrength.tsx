import { MIN_PASSWORD_LENGTH } from '../../api/auth';
import { passwordProblem } from '../../auth/passwordPolicy';
import { cn } from '../ui/cn';

interface Props {
  password: string;
  email?: string;
  firstName?: string;
}

// Conta la lunghezza, non i simboli: una frase lunga è più difficile da indovinare di "Ciao1!"
// e più facile da ricordare (linee guida NIST 800-63B).
function level(password: string, email: string, firstName: string): { bars: number; text: string; tone: string } {
  if (!password) return { bars: 0, text: `Almeno ${MIN_PASSWORD_LENGTH} caratteri: una frase facile da ricordare è l'ideale.`, tone: '' };
  if (passwordProblem(password, email, firstName)) {
    const short = [...password].length < MIN_PASSWORD_LENGTH;
    return { bars: 1, text: short ? `Troppo corta: almeno ${MIN_PASSWORD_LENGTH} caratteri` : 'Troppo prevedibile', tone: 'bg-danger' };
  }
  const length = [...password].length;
  if (length < 14) return { bars: 2, text: 'Va bene', tone: 'bg-warning-soft-foreground' };
  if (length < 20) return { bars: 3, text: 'Buona', tone: 'bg-success-soft-foreground' };
  return { bars: 4, text: 'Ottima', tone: 'bg-success-soft-foreground' };
}

/**
 * Indicatore della robustezza, da usare come suggerimento del campo (dentro un <p>): i lettori
 * di schermo lo leggono insieme al campo, senza annunci a ogni tasto.
 */
export default function PasswordStrength({ password, email = '', firstName = '' }: Props) {
  const { bars, text, tone } = level(password, email, firstName);
  return (
    <span className="flex flex-col gap-1.5">
      <span className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={cn('h-1.5 flex-1 rounded-full bg-line transition-colors duration-200', n <= bars && tone)} />
        ))}
      </span>
      <span>{bars > 0 && <span className="sr-only">Robustezza della password: </span>}{text}</span>
    </span>
  );
}
