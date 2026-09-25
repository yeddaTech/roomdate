import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { cn, focusRing } from './cn';

// Controlli dei form: stesso aspetto per input, textarea e select nativi (sul telefono il select
// nativo è più comodo di qualsiasi menu personalizzato).
const control =
  'w-full rounded-control border border-control bg-surface px-4 text-base text-foreground placeholder:text-foreground-subtle ' +
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger ' +
  focusRing;

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-12', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-24 py-3 resize-y', className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(control, 'h-12 cursor-pointer pr-10', className)} {...props} />;
}

interface FieldProps {
  label: ReactNode;
  /** Il controllo (Input, Textarea, Select...): riceve id, aria-describedby e aria-invalid. */
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
  hint?: ReactNode;
  /** Errore da mostrare sotto il campo; lo annunciano anche i lettori di schermo. */
  error?: string;
  className?: string;
}

/**
 * Etichetta, controllo, suggerimento ed errore collegati tra loro: cliccando l'etichetta si va al
 * campo e i lettori di schermo leggono suggerimento ed errore insieme al campo.
 */
export function Field({ label, children, hint, error, className }: FieldProps) {
  const id = useId();
  const controlId = children.props.id ?? id;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [children.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className="text-sm font-bold text-foreground">{label}</label>
      {isValidElement(children) &&
        cloneElement(children, { id: controlId, 'aria-describedby': describedBy, 'aria-invalid': error ? true : children.props['aria-invalid'] })}
      {hint && <p id={hintId} className="text-sm text-foreground-muted">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-sm font-bold text-danger">{error}</p>}
    </div>
  );
}
