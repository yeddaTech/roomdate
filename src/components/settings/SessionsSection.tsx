import { toast } from 'sonner';
import { Laptop } from 'lucide-react';
import { useRevokeOtherSessions, useRevokeSession, useSessions } from '../../api/hooks';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Skeleton from '../ui/Skeleton';
import SettingsSection from './SettingsSection';
import { whenLabel } from './when';

/** Dispositivi con l'accesso aperto: si può chiudere quello di un dispositivo che non si riconosce. */
export default function SessionsSection() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const others = sessions.data?.filter((s) => !s.current).length ?? 0;

  const closeOne = async (id: string) => {
    try {
      await revoke.mutateAsync(id);
      toast.success('Accesso chiuso su quel dispositivo.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operazione non riuscita.');
    }
  };

  const closeOthers = async () => {
    try {
      const closed = await revokeOthers.mutateAsync();
      toast.success(closed === 1 ? 'Chiuso l’accesso su 1 altro dispositivo.' : `Chiusi gli accessi su ${closed} altri dispositivi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operazione non riuscita.');
    }
  };

  return (
    <SettingsSection
      id="dispositivi"
      title="Dispositivi collegati"
      description="Da dove è aperto il tuo account. Se non riconosci un dispositivo, chiudine l’accesso e cambia la password."
    >
      {sessions.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : sessions.isError ? (
        <Alert tone="danger">{sessions.error.message}</Alert>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.data.map((session) => (
            <li key={session.id} data-testid="session" className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Laptop className="size-5 shrink-0 text-foreground-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-bold text-foreground">
                    {session.device}
                    {session.current && <span className="ml-2 inline-block rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold whitespace-nowrap text-success-soft-foreground">questo dispositivo</span>}
                  </p>
                  <p className="text-sm text-foreground-muted">Ultimo uso {whenLabel(session.lastUsedAt)} · accesso {whenLabel(session.createdAt)}</p>
                </div>
              </div>
              {!session.current && (
                <Button variant="secondary" size="sm" onClick={() => closeOne(session.id)} disabled={revoke.isPending}>Chiudi l’accesso</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {others > 0 && (
        <Button variant="secondary" onClick={closeOthers} loading={revokeOthers.isPending} className="self-start">Esci da tutti gli altri dispositivi</Button>
      )}
    </SettingsSection>
  );
}
