import type { ReactNode } from 'react';
import { cn } from './cn';

interface EmptyStateProps {
  /** Icona lucide-react, es. <SearchX /> */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Cosa fare adesso, es. un pulsante "Pubblica un annuncio" */
  action?: ReactNode;
  className?: string;
  /** Livello del titolo: h1 quando lo stato vuoto è tutta la pagina (404, errori). */
  headingLevel?: 'h1' | 'h2' | 'h3';
}

/** Cosa mostrare quando un elenco è vuoto: perché lo è e cosa si può fare. */
export default function EmptyState({ icon, title, description, action, className, headingLevel: Heading = 'h3' }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      {icon && <div className="mb-1 flex size-14 items-center justify-center rounded-full bg-surface-muted text-foreground-muted [&_svg]:size-7" aria-hidden="true">{icon}</div>}
      <Heading className={cn('font-bold text-foreground', Heading === 'h1' ? 'font-display text-3xl' : 'text-lg')}>{title}</Heading>
      {description && <p className="max-w-sm text-sm text-foreground-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
