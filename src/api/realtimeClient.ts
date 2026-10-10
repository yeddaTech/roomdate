import Pusher, { type Options } from 'pusher-js';
import { authorizeChannel, PUSHER_KEY } from './realtime';

// La libreria di Pusher pesa circa 18 KB compressi e serve solo a chi ha fatto l'accesso: questo
// modulo si carica a richiesta (import dinamico in RealtimeProvider), non con la prima pagina.

/** Crea la connessione a Pusher; solo se realtimeEnabled. */
export function createRealtimeClient(): Pusher {
  const options: Options = {
    cluster: import.meta.env.VITE_PUSHER_CLUSTER,
    // La firma passa dal client API: JSON, cookie di sessione e controllo dell'origine come le altre richieste
    channelAuthorization: {
      customHandler: ({ socketId, channelName }, callback) => {
        authorizeChannel(socketId, channelName).then(
          (data) => callback(null, data),
          (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), null),
        );
      },
    },
  };
  // Solo sviluppo: un server compatibile con Pusher sulla propria macchina (es. soketi)
  const host: string | undefined = import.meta.env.VITE_PUSHER_HOST;
  if (host) {
    Object.assign(options, {
      wsHost: host,
      wsPort: Number(import.meta.env.VITE_PUSHER_PORT ?? 6001),
      forceTLS: false,
      enabledTransports: ['ws'],
    });
  }
  return new Pusher(PUSHER_KEY ?? '', options);
}
