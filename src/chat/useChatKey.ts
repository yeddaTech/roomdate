import { useCallback, useEffect, useState } from 'react';
import { getPrivateKey, hasStoredVault, unlockPrivateKey } from '../auth/keyStorage';

/**
 * La chiave privata che apre i messaggi, conservata in IndexedDB come CryptoKey non estraibile:
 * si legge in modo asincrono. Finché non è stata cercata (checked false) la chat non si mostra
 * bloccata, così non lampeggia il lucchetto a ogni apertura.
 */
export function useChatKey() {
  const [state, setState] = useState<{ checked: boolean; key: CryptoKey | null }>({ checked: false, key: null });
  // La chiave cifrata salvata all'accesso: se manca, la password da sola non basta
  const [hasVault] = useState(hasStoredVault);

  useEffect(() => {
    let cancelled = false;
    getPrivateKey().then((key) => {
      if (!cancelled) setState({ checked: true, key });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Apre la chiave con la password; false se la password non è quella giusta. */
  const unlock = useCallback(async (password: string) => {
    if (!(await unlockPrivateKey(password))) return false;
    setState({ checked: true, key: await getPrivateKey() });
    return true;
  }, []);

  return { ...state, hasVault, unlock };
}
