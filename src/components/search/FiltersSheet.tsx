import type { ReactNode } from 'react';
import { Sheet, SheetContent } from '../ui/Sheet';

/**
 * I filtri della ricerca sul telefono, in un pannello dal basso. Il codice è in un file a parte (con
 * Radix Dialog): la pagina dei risultati si apre senza aspettarlo.
 */
export default function FiltersSheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" title="Filtri">
        {children}
      </SheetContent>
    </Sheet>
  );
}
