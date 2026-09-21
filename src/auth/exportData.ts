import { listMessages } from '../api/chat';
import { request } from '../api/client';
import type { ChatMessage } from '../api/types';
import { decryptFromRecipients, decryptMessage } from '../utils/crypto';
import { getPrivateKey } from './keyStorage';

// Esportazione dei dati personali (GDPR, modulo M3.3). Il server fornisce tutto ciò che conserva
// tranne il testo dei messaggi, che è cifrato: il browser li scarica e li apre con la chiave privata.

interface ExportedMessage {
  sentAt: string;
  fromMe: boolean;
  /** null se sul dispositivo non c'è la chiave per aprirlo. */
  text: string | null;
}

interface ServerExport {
  conversations: { id: number; messages?: ExportedMessage[] }[];
  [key: string]: unknown;
}

async function allMessages(conversationId: number): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [];
  let cursor = '';
  do {
    const page = await listMessages(conversationId, { cursor });
    messages.push(...page.items);
    cursor = page.nextCursor ?? '';
  } while (cursor);
  // Le pagine arrivano dal più recente: nel file vanno in ordine di tempo
  return messages.reverse();
}

async function openMessage(message: ChatMessage, key: CryptoKey): Promise<string | null> {
  try {
    return message.format === 2 ? await decryptFromRecipients(message, key) : await decryptMessage(message.body, key);
  } catch {
    return null;
  }
}

/** Prepara il file JSON con tutti i dati dell'account, messaggi della chat compresi. */
export async function buildDataExport(userId: string): Promise<Blob> {
  const data = await request<ServerExport>('/api/v1/me/export');
  const key = await getPrivateKey();
  for (const conversation of data.conversations) {
    const messages = await allMessages(conversation.id);
    conversation.messages = await Promise.all(messages.map(async (m) => ({
      sentAt: m.createdAt,
      fromMe: m.senderId === userId,
      text: key ? await openMessage(m, key) : null,
    })));
  }
  if (!key) {
    data.messagesNote = 'Su questo dispositivo non c\'era la chiave per leggere i messaggi: accedi di nuovo e ripeti l\'esportazione per averne il testo.';
  }
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}
