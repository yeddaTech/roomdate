import { cn } from './cn';

interface Props {
  /** Titoli dei passi, nell'ordine. */
  steps: readonly string[];
  /** Passo attuale, da 1. */
  current: number;
  /** Nome dell'elenco per i lettori di schermo, es. "Passi della registrazione". */
  label: string;
}

/** "Passo 2 di 4" con le barre dei passi: completati, attuale e da fare. */
export default function StepIndicator({ steps, current, label }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold text-foreground-muted">Passo {current} di {steps.length}</p>
      <ol className="flex gap-2" aria-label={label}>
        {steps.map((title, i) => {
          const n = i + 1;
          return (
            <li key={title} className="flex flex-1 flex-col gap-2" aria-current={n === current ? 'step' : undefined}>
              <span className={cn('h-1.5 rounded-full transition-colors duration-200', n <= current ? 'bg-primary' : 'bg-line')} aria-hidden="true" />
              <span className={cn('hidden text-xs font-bold sm:block', n === current ? 'text-foreground' : 'text-foreground-muted')}>
                {title}
              </span>
              <span className="sr-only sm:hidden">{title}</span>
              {n < current && <span className="sr-only">, completato</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
