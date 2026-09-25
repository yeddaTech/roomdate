import { createContext, useContext, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  /** Testo del pulsante che conferma, es. "Elimina annuncio". */
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" per le azioni irreversibili o che colpiscono altri. */
  tone?: 'primary' | 'danger';
}

export type Confirm = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Chiede conferma con una finestra accessibile, al posto di window.confirm():
 *   if (!(await confirm({ title: 'Eliminare la foto?', confirmLabel: 'Elimina', tone: 'danger' }))) return;
 */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm va usato dentro <ConfirmProvider>');
  return confirm;
}
