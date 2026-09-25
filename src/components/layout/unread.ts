/** Testo per i lettori di schermo del badge dei messaggi non letti. */
export function unreadLabel(count: number): string {
  return count === 1 ? '1 conversazione con messaggi non letti' : `${count} conversazioni con messaggi non letti`;
}
