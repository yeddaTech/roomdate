import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMyProfile } from '../../api/hooks';
import { queryKeys } from '../../api/queryKeys';
import { setupRecoveryKey } from '../../auth/accountKeys';
import { useAuth } from '../../auth/AuthContext';
import RecoveryCodePanel from '../RecoveryCodePanel';
import Button from '../ui/Button';
import { Field } from '../ui/Field';
import PasswordInput from '../ui/PasswordInput';
import SettingsSection from './SettingsSection';

/** Chiave di recupero: il server non conosce il codice, si mostra una volta sola appena creato. */
export default function RecoverySection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasKey = useMyProfile().data?.hasRecoveryKey ?? false;
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Scrivi la tua password');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const created = await setupRecoveryKey(user?.email ?? '', password);
      if (!created) {
        setError('Password errata.');
        return;
      }
      setPassword('');
      setCode(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creazione non riuscita. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  const done = () => {
    setCode(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
    toast.success('Chiave di recupero salvata. Quella precedente non vale più.');
  };

  if (code) {
    return (
      <section id="recupero" className="scroll-mt-24 rounded-card border border-line bg-surface p-6 shadow-card md:p-8">
        <RecoveryCodePanel code={code} doneLabel="Ho finito" onDone={done} headingLevel="h2" />
      </section>
    );
  }

  return (
    <SettingsSection
      id="recupero"
      title="Chiave di recupero"
      description={hasKey
        ? 'Hai una chiave di recupero: se dimentichi la password, con la chiave e la tua email ne scegli una nuova senza perdere i messaggi. Creandone una nuova, quella precedente smette di valere.'
        : 'Non hai ancora una chiave di recupero. Senza, se dimentichi la password perdi l’accesso e i messaggi: sono cifrati sul tuo dispositivo e nemmeno noi possiamo aprirli.'}
    >
      <form noValidate onSubmit={create} className="flex max-w-md flex-col gap-4">
        <input type="email" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        <Field label="La tua password" error={error}>
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" variant={hasKey ? 'secondary' : 'primary'} loading={busy} className="self-start">
          {hasKey ? 'Crea una chiave nuova' : 'Crea la chiave di recupero'}
        </Button>
      </form>
    </SettingsSection>
  );
}
