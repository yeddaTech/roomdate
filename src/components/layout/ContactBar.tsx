import type { ReactNode } from 'react';
import { useHideTabBar } from './layoutContext';

/**
 * Sul telefono l'azione principale della pagina (es. "Contatta") resta in fondo allo schermo, a
 * portata di pollice, al posto della barra di navigazione. La pagina deve lasciarle spazio sotto
 * (pb-28 md:pb-0). Su desktop non c'è: la stessa azione sta nella colonna laterale.
 */
export default function ContactBar({ children }: { children: ReactNode }) {
  useHideTabBar(true);
  return (
    <div data-testid="contact-bar" className="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3">{children}</div>
    </div>
  );
}
