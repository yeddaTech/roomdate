import type { ComponentProps, ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from './cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: { box: 'bg-surface-muted text-foreground', icon: <Info /> },
  success: { box: 'bg-success-soft text-success-soft-foreground', icon: <CircleCheck /> },
  warning: { box: 'bg-warning-soft text-warning-soft-foreground', icon: <TriangleAlert /> },
  danger: { box: 'bg-danger-soft text-danger-soft-foreground', icon: <CircleAlert /> },
};

interface AlertProps extends Omit<ComponentProps<'div'>, 'title'> {
  tone?: AlertTone;
  title?: ReactNode;
}

/**
 * Messaggio dentro la pagina, vicino a ciò che riguarda (es. "Credenziali non valide" sopra il
 * modulo). Un errore si annuncia subito ai lettori di schermo, gli altri toni con discrezione.
 */
export default function Alert({ tone = 'info', title, className, children, ...props }: AlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-control p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0', tones[tone].box, className)}
      {...props}
    >
      {tones[tone].icon}
      <div className="flex flex-col gap-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
