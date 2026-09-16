import { request } from './client';
import type { Conversation } from './types';

// --- API legacy (diventano /api/v1 nel modulo M1.7) ---

export async function listConversations(): Promise<Conversation[]> {
  const rows = await request<Conversation[] | null>('/api/get_chats');
  return (rows ?? []).map((c) => ({ ...c, messages: c.messages ?? [] }));
}

export type StartChatTarget = { listingId: number } | { targetId: string };

export async function startChat(target: StartChatTarget): Promise<number> {
  const { conversationId } = await request<{ conversationId: number }>('/api/start_chat', { method: 'POST', body: target });
  return conversationId;
}

export interface OutgoingMessage {
  conversationId: number;
  /** Cifrato con la chiave pubblica del destinatario. */
  text: string;
  /** Cifrato con la chiave pubblica del mittente, per rileggere i propri messaggi. */
  senderText: string;
}

export async function sendMessage(message: OutgoingMessage): Promise<void> {
  await request<unknown>('/api/send_message', { method: 'POST', body: message });
}

export async function notifyTyping(conversationId: number): Promise<void> {
  await request<unknown>('/api/typing', { method: 'POST', body: { conversationId: String(conversationId) } });
}
