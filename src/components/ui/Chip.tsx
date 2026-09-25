import type { ComponentProps } from 'react';
import { cn, focusRing } from './cn';

interface ChipProps extends ComponentProps<'button'> {
  /** Chip selezionabile (es. un filtro o un'abitudine): lo stato si legge anche con la tastiera. */
  selected?: boolean;
}

export default function Chip({ selected = false, className, type = 'button', ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors duration-150',
        '[&_svg]:size-4',
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-control bg-surface text-foreground-muted hover:border-foreground hover:text-foreground',
        focusRing, className,
      )}
      {...props}
    />
  );
}
