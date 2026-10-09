// Come si dispongono i messaggi di una conversazione: per giorno, e nel giorno in gruppi di
// messaggi consecutivi della stessa persona, come nelle app di messaggi. Funzioni pure, senza React.

import { dayKey, dayLabel } from './time';

/** Stato di un messaggio: salvato, in invio, oppure non partito (con "Riprova"). */
export type DeliveryStatus = 'sent' | 'sending' | 'failed';

/** Un messaggio da mostrare: salvato sul server o ancora in viaggio dal browser. */
export interface ThreadItem {
  /** Chiave stabile per React: "m-<id>" per i salvati, l'ID locale per quelli in viaggio. */
  key: string;
  senderId: string;
  /** Istante ISO 8601. */
  createdAt: string;
  text: string;
  status: DeliveryStatus;
}

/** Messaggi consecutivi della stessa persona, a pochi minuti l'uno dall'altro. */
export interface MessageGroup {
  key: string;
  senderId: string;
  mine: boolean;
  /** Il separatore "Nuovi messaggi" va subito prima di questo gruppo. */
  unreadStart: boolean;
  items: ThreadItem[];
}

export interface DaySection {
  key: string;
  label: string;
  groups: MessageGroup[];
}

/** Oltre questo intervallo due messaggi della stessa persona fanno gruppi separati. */
export const GROUP_GAP_MS = 5 * 60 * 1000;

interface ThreadOptions {
  myId: string;
  /**
   * Ultima lettura al momento dell'apertura: i messaggi dell'altro arrivati dopo sono nuovi.
   * null: mai letta (tutti i suoi messaggi sono nuovi); undefined: nessun separatore.
   */
  unreadAfter?: string | null;
  today?: Date;
}

/** Ordina i messaggi nel tempo e li divide per giorno e per gruppo. */
export function buildThread(items: ThreadItem[], { myId, unreadAfter, today = new Date() }: ThreadOptions): DaySection[] {
  const sorted = items
    .map((item, index) => ({ item, index, time: Date.parse(item.createdAt) }))
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ item }) => item);

  const firstUnread = unreadAfter === undefined
    ? -1
    : sorted.findIndex((item) => item.senderId !== myId && item.status === 'sent' &&
        (unreadAfter === null || Date.parse(item.createdAt) > Date.parse(unreadAfter)));

  const days: DaySection[] = [];
  let lastTime = 0;
  sorted.forEach((item, index) => {
    const key = dayKey(item.createdAt);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(item.createdAt, today), groups: [] };
      days.push(day);
    }
    const time = Date.parse(item.createdAt);
    const group = day.groups[day.groups.length - 1];
    const unreadStart = index === firstUnread;
    if (!group || group.senderId !== item.senderId || unreadStart || time - lastTime > GROUP_GAP_MS) {
      day.groups.push({ key: item.key, senderId: item.senderId, mine: item.senderId === myId, unreadStart, items: [item] });
    } else {
      group.items.push(item);
    }
    lastTime = time;
  });
  return days;
}
