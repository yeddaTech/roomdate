import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, LockKeyhole } from 'lucide-react';
import type { AuthLocationState } from '../../auth/authLocation';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { cn, focusRing } from '../ui/cn';
import { Field } from '../ui/Field';
import PasswordInput from '../ui/PasswordInput';

interface Props {
  email: string;
  /** Su questo dispositivo c'è la chiave privata cifrata, da aprire con la password. */
  hasVault: boolean;
  /** Prova la password: true se ha aperto la chiave. */
  onUnlock: (password: string) => Promise<boolean>;
  /** Esce e torna all'accesso, che riporta la chiave su questo dispositivo. */
  onSignInAgain: () => Promise<void>;
}

/**
 * Chat chiusa a chiave su questo dispositivo: i messaggi sono cifrati end-to-end e la chiave che
 * li apre è protetta dalla password, che non lascia mai il browser. Serve dopo aver svuotato i
 * dati del sito o su un dispositivo dove la chiave non si era aperta all'accesso.
 */
export default function UnlockPanel({ email, hasVault, onUnlock, onSignInAgain }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Scrivi la password del tuo account.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (!(await onUnlock(password))) setError('Password errata: i messaggi restano chiusi. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  const signInAgain = async () => {
    setBusy(true);
    await onSignInAgain();
  };

  return (
    <div className="flex min-h-full items-center justify-center overflow-y-auto p-4 py-8">
      <Card className="flex w-full max-w-md flex-col gap-6" data-testid="unlock-panel">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground [&_svg]:size-7" aria-hidden="true">
          <LockKeyhole />
        </span>
        {hasVault ? (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">Sblocca i tuoi messaggi</h1>
              <p className="text-foreground-muted">
                I messaggi sono cifrati end-to-end: solo tu e chi ti scrive potete leggerli. Su questo dispositivo la chiave
                che li apre è protetta dalla tua password.
              </p>
            </div>
            {error && <Alert tone="danger">{error}</Alert>}
            <form noValidate onSubmit={submit} className="flex flex-col gap-5">
              {/* Per il gestore delle password: sa per quale account proporre la password */}
              <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
              <Field label="Password">
                <PasswordInput
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </Field>
              <Button type="submit" size="lg" loading={busy}>Sblocca i messaggi</Button>
            </form>
            <p className="flex gap-2 text-sm text-foreground-muted">
              <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Password dimenticata?{' '}
                <Link
                  to="/recupero"
                  state={{ email } satisfies AuthLocationState}
                  className={cn('rounded-sm font-bold text-primary hover:text-primary-hover', focusRing)}
                >
                  Usa la chiave di recupero
                </Link>
                : scegli una password nuova e i messaggi restano leggibili.
              </span>
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">Accedi di nuovo per leggere i messaggi</h1>
              <p className="text-foreground-muted">
                Su questo dispositivo manca la chiave che apre i tuoi messaggi cifrati, per esempio dopo aver cancellato i dati
                del browser. Esci e accedi di nuovo: la chiave arriva con l'accesso, protetta dalla tua password.
              </p>
            </div>
            <Button size="lg" loading={busy} onClick={signInAgain}>Esci e accedi di nuovo</Button>
          </>
        )}
      </Card>
    </div>
  );
}
