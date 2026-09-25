import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthProvider';
import ConfirmProvider from '../ui/ConfirmProvider';
import Toaster from '../ui/Toaster';

/**
 * Cambiando pagina il focus va al contenuto (id "contenuto" in ogni layout), così chi usa un
 * lettore di schermo sente la pagina nuova invece di restare sul link appena cliccato. Se la
 * pagina ha già messo il focus su un suo campo, lo lascia lì.
 */
function FocusOnNavigate() {
  const { pathname } = useLocation();
  // Il percorso precedente, non un "primo giro": in sviluppo React esegue l'effetto due volte
  // all'avvio e un semplice flag sposterebbe il focus già al primo caricamento
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const main = document.getElementById('contenuto');
    const active = document.activeElement;
    if (main && (!active || active === document.body || !main.contains(active))) main.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

/** Radice dell'app: sessione, conferme, notifiche e comportamento comune a tutte le pagine. */
export default function RootLayout() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Outlet />
        <Toaster />
        {/* Indietro e avanti tornano al punto in cui si era; una pagina nuova parte dall'alto */}
        <ScrollRestoration />
        <FocusOnNavigate />
      </ConfirmProvider>
    </AuthProvider>
  );
}
