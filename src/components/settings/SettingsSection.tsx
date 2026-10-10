import type { ReactNode } from 'react';
import Card from '../ui/Card';
import { cn } from '../ui/cn';

interface Props {
  /** Ancora dell'indirizzo, es. "privacy" per /impostazioni#privacy. */
  id: string;
  title: string;
  description?: ReactNode;
  tone?: 'default' | 'danger';
  children: ReactNode;
}

/** Una sezione delle impostazioni: titolo, spiegazione e controlli. */
export default function SettingsSection({ id, title, description, tone = 'default', children }: Props) {
  return (
    <section id={id} aria-labelledby={`${id}-titolo`} className="scroll-mt-24">
      <Card className={cn('flex flex-col gap-5 md:p-8', tone === 'danger' && 'border-danger/40')}>
        <div className="flex flex-col gap-1.5">
          <h2 id={`${id}-titolo`} className={cn('text-xl font-bold', tone === 'danger' ? 'text-danger' : 'text-foreground')}>{title}</h2>
          {description && <p className="text-sm leading-relaxed text-foreground-muted">{description}</p>}
        </div>
        {children}
      </Card>
    </section>
  );
}
