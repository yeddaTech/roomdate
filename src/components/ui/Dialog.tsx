import type { ComponentProps, ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn, focusRing } from './cn';

// Finestra modale su Radix: il focus resta dentro finché è aperta, Esc la chiude e al termine il
// focus torna al pulsante che l'ha aperta. Titolo e descrizione sono annunciati dai lettori di schermo.

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps extends Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> {
  title: ReactNode;
  /** Frase sotto il titolo; se manca, il contenuto va descritto in altro modo. */
  description?: ReactNode;
  /** Nasconde la X in alto (es. quando serve una scelta esplicita). */
  hideClose?: boolean;
}

export function DialogContent({ title, description, hideClose = false, className, children, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[2000] bg-overlay animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-[2001] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4',
          'overflow-y-auto rounded-card bg-surface p-6 text-foreground shadow-overlay animate-dialog-in md:p-8',
          className,
        )}
        {...(description ? {} : { 'aria-describedby': undefined })}
        {...props}
      >
        <div className="flex flex-col gap-1.5 pr-8">
          <DialogPrimitive.Title className="font-display text-xl font-bold text-foreground">{title}</DialogPrimitive.Title>
          {description && <DialogPrimitive.Description className="text-sm text-foreground-muted">{description}</DialogPrimitive.Description>}
        </div>
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            className={cn('absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-muted hover:text-foreground', focusRing)}
            aria-label="Chiudi"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Riga dei pulsanti in fondo a una finestra: su telefono uno sopra l'altro, l'azione principale in alto. */
export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end', className)} {...props} />;
}
