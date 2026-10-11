import { request } from './client';

// Notifiche push dei messaggi (modulo M2.8): la chiave del server e l'iscrizione di questo browser.

/** La chiave VAPID pubblica; errore push_unavailable se il server non ha le notifiche push. */
export function getPushKey(): Promise<{ publicKey: string }> {
  return request<{ publicKey: string }>('/api/v1/push/key');
}

/** Registra (o aggiorna) l'iscrizione di questo browser, legata alla sessione. */
export function savePushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
  return request<void>('/api/v1/me/push-subscriptions', { method: 'PUT', body: subscription });
}

export function deletePushSubscription(endpoint: string): Promise<void> {
  return request<void>('/api/v1/me/push-subscriptions', { method: 'DELETE', body: { endpoint } });
}
