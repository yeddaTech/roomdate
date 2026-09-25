import { AlertDialog } from 'radix-ui';
import { buttonClasses } from './buttonClasses';
import type { ConfirmOptions } from './confirm';

/**
 * La finestra di conferma vera e propria (AlertDialog di Radix: non si chiude cliccando fuori, e il
 * focus parte da "Annulla", la scelta più sicura). Sta in un file a parte perché si carica solo
 * quando serve: Radix non pesa sul primo caricamento del sito.
 */
export default function ConfirmDialogView({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  return (
    <AlertDialog.Root open onOpenChange={(open) => { if (!open) onClose(false); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[2100] bg-overlay animate-fade-in" />
        <AlertDialog.Content
          data-testid="confirm-dialog"
          className="fixed left-1/2 top-1/2 z-[2101] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-card bg-surface p-6 text-foreground shadow-overlay animate-dialog-in md:p-8"
          {...(options.description ? {} : { 'aria-describedby': undefined })}
        >
          <AlertDialog.Title className="font-display text-xl font-bold">{options.title}</AlertDialog.Title>
          {options.description && (
            <AlertDialog.Description className="text-sm text-foreground-muted">{options.description}</AlertDialog.Description>
          )}
          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className={buttonClasses({ variant: 'secondary' })}>{options.cancelLabel ?? 'Annulla'}</AlertDialog.Cancel>
            <AlertDialog.Action
              className={buttonClasses({ variant: options.tone === 'danger' ? 'danger' : 'primary' })}
              onClick={() => onClose(true)}
            >
              {options.confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
