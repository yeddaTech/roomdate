import type { ReactNode } from 'react';
import { MapPin, TriangleAlert, Wallet } from 'lucide-react';
import { lifestyleTag } from '../../api/options';
import type { Compatibility } from '../../api/types';
import { cn } from '../ui/cn';

interface Item {
  key: string;
  content: ReactNode;
  warning?: boolean;
}

/** Voci di compatibilità; la voce "warning" segnala una differenza da considerare. */
function compatibilityItems(c: Compatibility): Item[] {
  const items: Item[] = [];
  if (c.sameCity) items.push({ key: 'citta', content: <><MapPin aria-hidden="true" /> Stessa città</> });
  if (c.similarBudget) items.push({ key: 'budget', content: <><Wallet aria-hidden="true" /> Budget simile</> });
  for (const key of c.sharedTags) {
    const tag = lifestyleTag(key);
    if (tag) items.push({ key, content: <><span aria-hidden="true">{tag.emoji}</span> {tag.label}</> });
  }
  if (c.smokingMismatch) items.push({ key: 'fumo', content: <><TriangleAlert aria-hidden="true" /> Abitudini diverse sul fumo</>, warning: true });
  return items;
}

/**
 * Cosa hanno in comune l'utente e un altro profilo, in breve per le schede dell'elenco. La
 * spiegazione voce per voce è nel profilo (CompatibilityDetails).
 */
export default function CompatibilityList({ compatibility }: { compatibility: Compatibility }) {
  const items = compatibilityItems(compatibility);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-bold text-foreground-muted" aria-hidden="true">In comune con te</p>
      <ul className="flex flex-wrap gap-1.5" aria-label="In comune con te">
        {items.map((item) => (
          <li
            key={item.key}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold [&_svg]:size-3.5',
              item.warning ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-success-soft text-success-soft-foreground',
            )}
          >
            {item.content}
          </li>
        ))}
      </ul>
    </div>
  );
}
