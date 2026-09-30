import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { THEME_BAR_COLORS, THEME_STORAGE_KEY, ThemeContext, type ThemePreference } from './theme';

function readPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/**
 * Tema chiaro o scuro: quello scelto sul sito, ricordato in questo browser, oppure quello del
 * dispositivo, seguito anche quando cambia (es. il telefono che passa allo scuro la sera).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);
  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const query = darkQuery();
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // La scelta fatta in un'altra scheda vale anche qui
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) setPreferenceState(readPreference());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains('dark') === (theme === 'dark')) return;
    // Senza transizioni per un attimo: altrimenti ogni elemento cambierebbe colore con i suoi tempi
    root.classList.add('theme-switching');
    root.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BAR_COLORS[theme]);
    void window.getComputedStyle(document.body).backgroundColor; // i colori nuovi si applicano adesso
    const timer = window.setTimeout(() => root.classList.remove('theme-switching'), 1);
    return () => {
      window.clearTimeout(timer);
      root.classList.remove('theme-switching');
    };
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // archivio non disponibile: la scelta vale finché la pagina resta aperta
    }
  }, []);

  const value = useMemo(() => ({ preference, theme, setPreference }), [preference, theme, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
