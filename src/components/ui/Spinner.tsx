import { LoaderCircle } from 'lucide-react';
import { cn } from './cn';

/** Indicatore di attesa. Senza label è decorativo: chi lo usa annuncia l'attesa in altro modo. */
export default function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <LoaderCircle
      className={cn('size-4 animate-spin', className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'status' : undefined}
    />
  );
}
