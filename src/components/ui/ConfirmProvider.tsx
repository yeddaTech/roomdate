import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { afterPageLoad } from './afterPageLoad';
import { ConfirmContext, type ConfirmOptions } from './confirm';

const loadView = () => import('./ConfirmDialogView');
const ConfirmDialogView = lazy(loadView);

/**
 * Fornisce useConfirm() a tutta l'app, con un'unica finestra di conferma. Il codice della finestra
 * si scarica in background dopo il caricamento della pagina, così è pronto al primo uso.
 */
export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => afterPageLoad(() => { loadView().catch(() => {}); }, 5000), []);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Suspense fallback={null}>
        {options && <ConfirmDialogView options={options} onClose={close} />}
      </Suspense>
    </ConfirmContext.Provider>
  );
}
