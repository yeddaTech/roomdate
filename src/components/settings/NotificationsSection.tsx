import { useState } from 'react';
import { toast } from 'sonner';
import { realtimeEnabled } from '../../api/realtime';
import { alertsState, disableAlerts, enableAlerts, type AlertsState } from '../../realtime/notifications';
import Alert from '../ui/Alert';
import Checkbox from '../ui/Checkbox';
import SettingsSection from './SettingsSection';

/**
 * Avvisi del browser per i messaggi nuovi. Le email non ci sono (decisione D2): gli avvisi
 * arrivano mentre RoomDate è aperto in una scheda, anche nascosta dietro altre finestre.
 */
export default function NotificationsSection() {
  const [state, setState] = useState<AlertsState>(alertsState);
  const [busy, setBusy] = useState(false);

  const toggle = async (on: boolean) => {
    if (busy) return;
    if (!on) {
      disableAlerts();
      setState(alertsState());
      return;
    }
    setBusy(true);
    try {
      const next = await enableAlerts();
      setState(next);
      if (next === 'on') toast.success('Avvisi attivi su questo dispositivo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      id="avvisi"
      title="Avvisi dei messaggi"
      description="Un avviso del browser quando ti scrivono mentre RoomDate è aperto in un’altra scheda o dietro altre finestre. L’avviso dice solo chi ti ha scritto: il testo resta cifrato finché non apri la chat."
    >
      {state === 'unsupported' ? (
        <Alert>Questo browser non mostra avvisi ai siti (succede per esempio con Chrome sul telefono). Il numero dei messaggi non letti resta comunque sulla voce «Chat».</Alert>
      ) : state === 'blocked' ? (
        <Alert tone="warning">
          Hai bloccato gli avvisi di RoomDate in questo browser. Per riattivarli apri le impostazioni del sito, dall’icona accanto
          all’indirizzo, e consenti le notifiche.
        </Alert>
      ) : (
        <Checkbox checked={state === 'on'} onChange={(e) => toggle(e.target.checked)} data-testid="message-alerts">
          <span className="font-bold">Avvisami dei messaggi nuovi su questo dispositivo</span>
          <span className="block text-foreground-muted">Il browser ti chiederà il permesso. Con RoomDate chiuso gli avvisi non arrivano.</span>
        </Checkbox>
      )}
      {!realtimeEnabled && <p className="text-sm text-foreground-muted">Su questa versione del sito il tempo reale non è configurato: gli avvisi non partono.</p>}
    </SettingsSection>
  );
}
