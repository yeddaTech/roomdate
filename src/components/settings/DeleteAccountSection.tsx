import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteAccount } from '../../auth/accountKeys';
import { useAuth } from '../../auth/AuthContext';
import Button from '../ui/Button';
import { useConfirm } from '../ui/confirm';
import { Field } from '../ui/Field';
import PasswordInput from '../ui/PasswordInput';
import SettingsSection from './SettingsSection';

/** Eliminazione definitiva dell'account: il server chiede di nuovo la password. */
export default function DeleteAccountSection() {
  const { user, endLocalSession } = useAuth();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Scrivi la tua password per confermare');
      return;
    }
    const ok = await confirm({
      title: 'Eliminare definitivamente l’account?',
      description: 'Profilo, annunci, foto e dispositivi collegati verranno cancellati per sempre. Non si può annullare.',
      confirmLabel: 'Elimina account',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteAccount(user?.email ?? '', password);
      // Il server ha già chiuso la sessione: resta da pulire il browser (la pagina protetta rimanda alla home)
      endLocalSession('signed_out');
    } catch (err) {
      setPassword('');
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita. Riprova.');
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      id="elimina"
      tone="danger"
      title="Elimina l’account"
      description="Cancelli per sempre profilo, annunci con le foto, preferiti, dispositivi collegati, blocchi e segnalazioni ricevute. I messaggi che hai inviato restano, cifrati e senza il tuo nome, nelle conversazioni degli altri, come un messaggio già consegnato. Prima puoi scaricare una copia dei tuoi dati."
    >
      {open ? (
        <form noValidate onSubmit={submit} className="flex max-w-md flex-col gap-4">
          <input type="email" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
          <Field label="Conferma con la tua password" error={error}>
            <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="danger" loading={busy}><Trash2 aria-hidden="true" /> Elimina definitivamente</Button>
            <Button variant="ghost" onClick={() => { setOpen(false); setPassword(''); setError(undefined); }} disabled={busy}>Annulla</Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)} className="self-start text-danger">Elimina l’account</Button>
      )}
    </SettingsSection>
  );
}
