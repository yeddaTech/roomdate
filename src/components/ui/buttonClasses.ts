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

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 text-base gap-2',
  icon: 'size-11',
};

/** Classi di un pulsante, anche per un <Link> che deve sembrarlo. */
export function buttonClasses({ variant = 'primary', size = 'md', className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-full font-bold whitespace-nowrap transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
    focusRing, variants[variant], sizes[size], className,
  );
}
