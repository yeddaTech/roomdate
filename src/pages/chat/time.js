// Gli orari arrivano dal server in UTC e vengono mostrati nell'ora locale (anomalia F11).

/** "14:05" nell'ora locale di chi guarda. */
export function timeLabel(isoDate) {
  return new Date(isoDate).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/** "Oggi", "Ieri" oppure "12 settembre 2026": separatore tra i messaggi di giorni diversi. */
export function dayLabel(isoDate, today = new Date()) {
  const date = new Date(isoDate);
  const days = daysBetween(date, today);
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Ieri';
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Data breve per l'elenco delle conversazioni: "14:05" se è di oggi, altrimenti "12/09". */
export function shortDateLabel(isoDate, today = new Date()) {
  const date = new Date(isoDate);
  if (daysBetween(date, today) === 0) return timeLabel(isoDate);
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

/** Giorni di calendario tra due istanti, nell'ora locale. */
function daysBetween(date, today) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(today) - startOfDay(date)) / 86400000);
}
