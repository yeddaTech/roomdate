import { lifestyleTag } from '../../api/options';
import type { Compatibility } from '../../api/types';

/** Voci di compatibilità in testo; la voce "warning" segnala una differenza da considerare. */
function compatibilityItems(c: Compatibility): { text: string; warning?: boolean }[] {
  const items: { text: string; warning?: boolean }[] = [];
  if (c.sameCity) items.push({ text: '📍 Stessa città' });
  if (c.similarBudget) items.push({ text: '💶 Budget simile' });
  for (const key of c.sharedTags) {
    const tag = lifestyleTag(key);
    if (tag) items.push({ text: `${tag.emoji} ${tag.label}` });
  }
  if (c.smokingMismatch) items.push({ text: '⚠️ Abitudini diverse sul fumo', warning: true });
  return items;
}

interface Props {
  compatibility: Compatibility;
  /** Versione ridotta per le schede dell'elenco: niente titolo né spiegazione. */
  compact?: boolean;
}

/**
 * Cosa hanno in comune l'utente e un altro profilo. Il server confronta città, budget
 * (differenza entro 100 €) e abitudini indicate da entrambi: non esiste un punteggio.
 */
export default function CompatibilityList({ compatibility, compact = false }: Props) {
  const items = compatibilityItems(compatibility);
  const chips = items.map((item) => (
    <span
      key={item.text}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${item.warning ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'}`}
    >
      {item.text}
    </span>
  ));

  if (compact) {
    return items.length > 0 ? (
      <div>
        <div className="text-center text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5" aria-hidden="true">In comune con te</div>
        <div className="flex flex-wrap justify-center gap-1.5" aria-label="In comune con te">{chips}</div>
      </div>
    ) : null;
  }

  return (
    <div>
      <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-2 tracking-tight">In comune con te</h2>
      <p className="text-sm text-neutral-500 font-medium mb-4">
        Confronto tra città, budget (differenza entro 100 €) e abitudini indicate in entrambi i profili.
      </p>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">{chips}</div>
      ) : (
        <p className="text-neutral-400 font-medium italic">Nessun elemento in comune tra quelli indicati.</p>
      )}
    </div>
  );
}
