import { cn, focusRing } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-surface text-foreground border border-control hover:bg-surface-muted',
  ghost: 'text-foreground hover:bg-surface-muted',
  danger: 'bg-danger text-danger-foreground hover:bg-danger-hover',
  // Solo per gli inviti principali di marchio (es. nella home)
  brand: 'bg-brand text-white shadow-card hover:brightness-105',
};

// Altezza minima, non fissa: se lo spazio non basta (schermi da 320 px) il testo va a capo invece di
// uscire dal riquadro (WCAG 1.4.10)
const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4 py-1.5 text-sm gap-1.5',
  md: 'min-h-11 px-5 py-2 text-sm gap-2',
  lg: 'min-h-13 px-7 py-2.5 text-base gap-2',
  icon: 'size-11',
};

/** Classi di un pulsante, anche per un <Link> che deve sembrarlo. */
export function buttonClasses({ variant = 'primary', size = 'md', className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-full text-center font-bold transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
    focusRing, variants[variant], sizes[size], className,
  );
}
