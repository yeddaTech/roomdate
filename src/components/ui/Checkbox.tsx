import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from './cn';

interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  /** Il testo accanto alla casella: cliccandolo si spunta. Può contenere link. */
  children: ReactNode;
  /** Errore sotto la casella, collegato con aria-describedby. */
  error?: string;
}

/** Casella di spunta nativa (tastiera e lettori di schermo funzionano da sé) con i colori del sito. */
export default function Checkbox({ children, error, className, id, ...props }: CheckboxProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          {...props}
        />
        <label htmlFor={inputId} className="cursor-pointer text-sm leading-relaxed text-foreground">{children}</label>
      </div>
      {error && <p id={errorId} role="alert" className="pl-8 text-sm font-bold text-danger">{error}</p>}
    </div>
  );
}
