import type { ComponentProps, ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn, focusRing } from './cn';

// Pannello che scorre dal lato (menu, filtri): stesso comportamento accessibile della Dialog.

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

interface SheetContentProps extends Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  /** Da destra (menu) o dal basso (filtri su telefono). */
  side?: 'right' | 'bottom';
}

export function SheetContent({ title, description, side = 'right', className, children, ...props }: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[2000] bg-overlay animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-[2001] flex flex-col gap-4 overflow-y-auto bg-surface p-6 text-foreground shadow-overlay',
          side === 'right'
            ? 'inset-y-0 right-0 w-[min(20rem,85vw)] animate-sheet-in-right pt-[max(1.5rem,env(safe-area-inset-top))]'
            : 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-card animate-sheet-in-bottom pb-[max(1.5rem,env(safe-area-inset-bottom))]',
          className,
        )}
        {...(description ? {} : { 'aria-describedby': undefined })}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="text-lg font-bold text-foreground">{title}</DialogPrimitive.Title>
            {description && <DialogPrimitive.Description className="text-sm text-foreground-muted">{description}</DialogPrimitive.Description>}
          </div>
          <DialogPrimitive.Close
            className={cn('-mr-2 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-muted hover:text-foreground', focusRing)}
            aria-label="Chiudi"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
