import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { syncClosedSiteAlerts } from '../realtime/notifications';

/**
 * Collega l'app al service worker (modulo M2.8): toccando una notifica con RoomDate già aperto, il
 * service worker chiede di aprire la conversazione e l'app cambia pagina senza ricaricarsi. Dopo
 * l'accesso, se gli avvisi a sito chiuso sono attivi, ne aggiorna l'iscrizione sul server.
 */
export default function ServiceWorkerBridge() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (event: MessageEvent) => {
      const { type, url } = (event.data ?? {}) as { type?: string; url?: unknown };
      // Solo indirizzi del sito: "/chat/7", mai "//altro.sito"
      if (type === 'roomdate-open' && typeof url === 'string' && /^\/(?!\/)/.test(url)) navigate(url);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    // I messaggi del service worker arrivano solo dopo startMessages (o con onmessage)
    navigator.serviceWorker.startMessages();
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  useEffect(() => {
    if (userId) syncClosedSiteAlerts().catch(() => {});
  }, [userId]);

  return null;
}
