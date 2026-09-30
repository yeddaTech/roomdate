import { createContext, useContext } from 'react';

/** Scelta di chi usa il sito: un tema fisso, oppure quello del dispositivo. */
export type ThemePreference = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

/** Chiave in localStorage: la legge anche public/theme.js, prima che parta React. */
export const THEME_STORAGE_KEY = 'roomdate-theme';

/** Colore della barra del browser sul telefono: lo sfondo del tema (--background in index.css). */
export const THEME_BAR_COLORS: Record<Theme, string> = { light: '#fafaf9', dark: '#1c1824' };

export interface ThemeContextValue {
  preference: ThemePreference;
  /** Il tema mostrato adesso: con "system" dipende dal dispositivo. */
  theme: Theme;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme va usato dentro <ThemeProvider>');
  return value;
}
