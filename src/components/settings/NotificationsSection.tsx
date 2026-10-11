import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { realtimeEnabled } from '../../api/realtime';
import {
  alertsState,
  closedSiteState,
  disableAlerts,
  disableClosedSiteAlerts,
  enableAlerts,
  enableClosedSiteAlerts,
  type AlertsState,
  type ClosedSiteState,
} from '../../realtime/notifications';
import Alert from '../ui/Alert';
import Checkbox from '../ui/Checkbox';
import SettingsSection from './SettingsSection';

/**
 * Avvisi dei messaggi nuovi su questo dispositivo, su due livelli: con RoomDate aperto (anche in
 * un'altra scheda) e, se il browser lo permette, anche a sito chiuso con le notifiche push
 * (modulo M2.8). Le email non ci sono (decisione D2).
 */
export default function NotificationsSection() {
  const [state, setState] = useState<AlertsState>(alertsState);
  const [closed, setClosed] = useState<ClosedSiteState | null>(null);
  const [busy, setBusy] = useState(false);
  // La casella cambia subito al clic, mentre il browser chiede il permesso e il server risponde
  const [pending, setPending] = useState<{ alerts?: boolean; closed?: boolean }>({});

  useEffect(() => {
    let active = true;
    closedSiteState().then((next) => { if (active) setClosed(next); }).catch(() => {});
    return () => {
      active = false;
    };
  }, [state]);

  const toggle = async (on: boolean) => {
    if (busy) return;
    setBusy(true);
    setPending({ alerts: on });
    try {
      if (on) {
        const next = await enableAlerts();
        setState(next);
        if (next === 'on') toast.success('Avvisi attivi su questo dispositivo.');
      } else {
        await disableAlerts();
        setState(alertsState());
      }
    } finally {
      setPending({});
      setBusy(false);
    }
  };

  const toggleClosed = async (on: boolean) => {
    if (busy) return;
    setBusy(true);
    setPending({ closed: on });
    try {
      if (on) {
        await enableClosedSiteAlerts();
        toast.success('Ti avviseremo anche con RoomDate chiuso.');
      } else {
        await disableClosedSiteAlerts();
      }
    } catch {
      toast.error('Non è stato possibile attivare gli avvisi a sito chiuso. Riprova più tardi.');
    } finally {
      setClosed(await closedSiteState().catch(() => null));
      setPending({});
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      id="avvisi"
      title="Avvisi dei messaggi"
      description="Un avviso quando ti scrivono, anche se RoomDate è in un’altra scheda o dietro altre finestre. L’avviso dice solo chi ti ha scritto: il testo resta cifrato finché non apri la chat."
    >
      {state === 'unsupported' ? (
        <Alert>Questo browser non mostra avvisi ai siti. Il numero dei messaggi non letti resta comunque sulla voce «Chat».</Alert>
      ) : state === 'blocked' ? (
        <Alert tone="warning">
          Hai bloccato gli avvisi di RoomDate in questo browser. Per riattivarli apri le impostazioni del sito, dall’icona accanto
          all’indirizzo, e consenti le notifiche.
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <Checkbox checked={pending.alerts ?? state === 'on'} aria-busy={busy} onChange={(e) => toggle(e.target.checked)} data-testid="message-alerts">
            <span className="font-bold">Avvisami dei messaggi nuovi su questo dispositivo</span>
            <span className="block text-foreground-muted">Il browser ti chiederà il permesso.</span>
          </Checkbox>
          {state === 'on' && (closed === 'on' || closed === 'off') && (
            <Checkbox checked={pending.closed ?? closed === 'on'} aria-busy={busy} onChange={(e) => toggleClosed(e.target.checked)} data-testid="closed-site-alerts">
              <span className="font-bold">Anche con RoomDate chiuso</span>
              <span className="block text-foreground-muted">
                Gli avvisi passano, cifrati, dal servizio di notifiche del browser (di Google, Apple, Mozilla o Microsoft), che vede
                solo che ne arriva uno. Uscendo dall’account si spengono su questo dispositivo.
              </span>
            </Checkbox>
          )}
          {state === 'on' && closed === 'install' && (
            <p className="text-sm text-foreground-muted">
              Su iPhone e iPad gli avvisi con RoomDate chiuso arrivano solo installandola: tocca Condividi e poi «Aggiungi alla schermata Home».
            </p>
          )}
          {state === 'on' && closed === 'unsupported' && (
            <p className="text-sm text-foreground-muted">Questo browser avvisa solo mentre RoomDate è aperto.</p>
          )}
        </div>
      )}
      {!realtimeEnabled && <p className="text-sm text-foreground-muted">Su questa versione del sito il tempo reale non è configurato: gli avvisi non partono.</p>}
    </SettingsSection>
  );
}
