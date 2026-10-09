import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { SendHorizontal } from 'lucide-react';
import { cn, focusRing } from '../ui/cn';

/** Lunghezza massima di un messaggio: cifrato resta ben sotto il limite del server. */
export const MAX_MESSAGE_LENGTH = 4000;
/** Da qui in poi si mostra quanti caratteri restano. */
const COUNTER_FROM = 3500;
/** Altezza massima del campo, circa sei righe: poi scorre al suo interno. */
const MAX_HEIGHT_PX = 160;

interface Props {
  /** Nome dell'altro, per l'etichetta del campo ("Scrivi a Marco"). */
  recipient: string;
  /** Bozza da cui ripartire, tornando su questa conversazione. */
  initialText?: string;
  onDraftChange: (text: string) => void;
  onSend: (text: string) => void;
  /** Mentre si scrive: per "sta scrivendo" dall'altra parte. */
  onTyping: () => void;
  /** Domande pronte per iniziare, es. "Posso visitarla?". */
  suggestions?: string[];
  /** Mettere il cursore nel campo appena aperto (solo con mouse e tastiera, non sul telefono). */
  autoFocus?: boolean;
}

// Con il dito Invio va a capo, come nelle app di messaggi: si invia con il pulsante. Con mouse e
// tastiera Invio invia e Maiusc+Invio va a capo
const finePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

export default function Composer({ recipient, initialText = '', onDraftChange, onSend, onTyping, suggestions = [], autoFocus = false }: Props) {
  const [text, setText] = useState(initialText);
  const field = useRef<HTMLTextAreaElement>(null);
  const counterId = useId();

  // Il campo cresce con il testo, fino a circa sei righe
  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  useEffect(() => {
    if (autoFocus && finePointer()) field.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const change = (value: string) => {
    setText(value);
    onDraftChange(value);
    if (value.trim()) onTyping();
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const message = text.trim();
    if (!message) return;
    onSend(message);
    change('');
    // La tastiera del telefono resta aperta per il messaggio successivo
    field.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Durante la composizione (tastiere cinesi, giapponesi, alcune Android) Invio conferma la parola
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || !finePointer()) return;
    event.preventDefault();
    submit();
  };

  const insert = (suggestion: string) => {
    change(text.trim() ? `${text.trimEnd()} ${suggestion}` : suggestion);
    field.current?.focus();
  };

  const remaining = MAX_MESSAGE_LENGTH - text.length;
  const empty = !text.trim();

  return (
    <div className="shrink-0 border-t border-line bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-testid="composer">
      {suggestions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 pt-3 md:px-6" role="group" aria-label="Domande da fare">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => insert(suggestion)}
              className={cn('shrink-0 rounded-full border border-control bg-surface px-3.5 py-1.5 text-sm font-bold whitespace-nowrap text-foreground-muted transition-colors hover:border-primary hover:text-primary', focusRing)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="flex items-end gap-2 px-3 pt-3 md:px-6">
        <label className="sr-only" htmlFor={`${counterId}-field`}>Scrivi a {recipient}</label>
        <textarea
          ref={field}
          id={`${counterId}-field`}
          rows={1}
          value={text}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => change(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Scrivi un messaggio…"
          autoComplete="off"
          enterKeyHint={finePointer() ? 'send' : 'enter'}
          aria-describedby={text.length >= COUNTER_FROM ? counterId : undefined}
          className={cn(
            'max-h-40 min-h-12 flex-1 resize-none rounded-3xl border border-control bg-background px-4 py-3 text-base leading-snug text-foreground placeholder:text-foreground-subtle',
            focusRing, 'focus-visible:ring-offset-0',
          )}
        />
        <button
          type="submit"
          aria-label="Invia"
          // Il pulsante non prende il focus: sul telefono la tastiera non si chiude a ogni invio
          onMouseDown={(e) => e.preventDefault()}
          aria-disabled={empty || undefined}
          className={cn(
            'inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover [&_svg]:size-5',
            'aria-disabled:cursor-not-allowed aria-disabled:bg-surface-muted aria-disabled:text-foreground-subtle',
            focusRing,
          )}
        >
          <SendHorizontal aria-hidden="true" />
        </button>
      </form>
      {text.length >= COUNTER_FROM && (
        <p id={counterId} className={cn('px-6 pt-1 text-right text-xs', remaining < 100 ? 'font-bold text-danger' : 'text-foreground-muted')} aria-live="polite">
          {remaining === 1 ? 'Ancora 1 carattere' : `Ancora ${remaining} caratteri`}
        </p>
      )}
    </div>
  );
}
