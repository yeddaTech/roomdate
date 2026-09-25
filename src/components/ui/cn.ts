import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge conosce i token del design system (src/index.css): così una classe passata a un
// componente (es. "px-6") sostituisce quella predefinita invece di scontrarsi con lei.
const merge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['control', 'card'],
      shadow: ['card', 'overlay'],
      font: ['display'],
    },
  },
});

/** Unisce classi condizionali; in caso di conflitto vince l'ultima. */
export function cn(...classes: ClassValue[]): string {
  return merge(clsx(classes));
}

/** Anello di focus comune a tutti i controlli: visibile solo con la tastiera, contrasto 3:1. */
export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background';
