import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { useConfirm } from '../components/ui/confirm';

/**
 * Con modifiche non salvate, uscire dalla pagina chiede conferma: con un link del sito o
 * "Indietro" (finestra del sito), chiudendo la scheda o ricaricando (avviso del browser).
 * Cambiare solo i parametri dell'indirizzo, come il passo di una procedura, non conta.
 */
export function useLeaveGuard(dirty: boolean) {
  const confirm = useConfirm();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({
      title: 'Uscire senza salvare?',
      description: 'Le modifiche che non hai salvato andranno perse.',
      confirmLabel: 'Esci senza salvare',
      cancelLabel: 'Resta qui',
      tone: 'danger',
    }).then((leave) => (leave ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}
