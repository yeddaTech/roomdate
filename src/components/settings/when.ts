/** "oggi alle 14:05", "ieri alle 9:12" oppure "12 settembre alle 18:40". */
export function whenLabel(isoDate: string, today = new Date()): string {
  const date = new Date(isoDate);
  const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(today) - startOfDay(date)) / 86400000);
  if (days === 0) return `oggi alle ${time}`;
  if (days === 1) return `ieri alle ${time}`;
  return `${date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} alle ${time}`;
}
