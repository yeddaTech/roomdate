// Gli orari arrivano dal server in UTC e vengono mostrati nell'ora locale (anomalia F11).

/** "14:05" nell'ora locale di chi guarda. */
export function timeLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/** "Oggi", "Ieri", "lunedì" (in settimana) oppure "12 settembre 2026": separatore tra i giorni. */
export function dayLabel(isoDate: string, today = new Date()): string {
  const date = new Date(isoDate);
  const days = daysBetween(date, today);
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Ieri';
  if (days > 1 && days < 7) {
    const weekday = date.toLocaleDateString('it-IT', { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Data breve per l'elenco delle conversazioni: "14:05" se è di oggi, "Ieri", altrimenti "12/09". */
export function shortDateLabel(isoDate: string, today = new Date()): string {
  const date = new Date(isoDate);
  const days = daysBetween(date, today);
  if (days === 0) return timeLabel(isoDate);
  if (days === 1) return 'Ieri';
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

/** Chiave del giorno di calendario nell'ora locale, es. "2026-10-09". */
export function dayKey(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Giorni di calendario tra due istanti, nell'ora locale. */
function daysBetween(date: Date, today: Date): number {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(today) - startOfDay(date)) / 86400000);
}
