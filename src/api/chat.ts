import { request } from './client';
import type { ChatMessage, ConversationsPage, MessagesPage } from './types';

export type StartChatTarget = { listingId: number } | { targetId: string };

/** Apre la conversazione (o ne riusa una esistente) e ne restituisce l'ID. */
export async function startChat(target: StartChatTarget): Promise<number> {
  const { id } = await request<{ id: number }>('/api/v1/conversations', { method: 'POST', body: target });
  return id;
}

/** Una pagina di conversazioni, dalla più attiva, con ultimo messaggio e non letti. */
export function listConversations({ cursor = '' } = {}): Promise<ConversationsPage> {
  return request<ConversationsPage>(`/api/v1/conversations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
}

/** Una pagina di messaggi, dal più recente: il cursore carica quelli più vecchi. */
export function listMessages(conversationId: number, { cursor = '' } = {}): Promise<MessagesPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return request<MessagesPage>(`/api/v1/conversations/${conversationId}/messages${query}`);
}

/** Messaggio cifrato: un testo e la chiave del messaggio cifrata per ogni partecipante. */
export interface OutgoingMessage {
  body: string;
  iv: string;
  keys: { userId: string; key: string }[];
}

export function sendMessage(conversationId: number, message: OutgoingMessage): Promise<ChatMessage> {
  return request<ChatMessage>(`/api/v1/conversations/${conversationId}/messages`, { method: 'POST', body: message });
}

/** Quante conversazioni hanno messaggi non ancora letti: il numero sul badge della chat. */
export async function getUnreadCount(): Promise<number> {
  const { conversations } = await request<{ conversations: number }>('/api/v1/me/unread');
  return conversations;
}

/** Segna come letti i messaggi della conversazione fino a ora. */
export function markConversationRead(conversationId: number): Promise<void> {
  return request<void>(`/api/v1/conversations/${conversationId}/read`, { method: 'POST' });
}
