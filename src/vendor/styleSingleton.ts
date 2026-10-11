import { useEffect } from 'react';

// Sostituisce react-style-singleton, usato da react-remove-scroll (cioè dalle finestre e dai pannelli
// Radix per bloccare lo scorrimento della pagina), con la stessa API (modulo M3.7). L'originale scrive
// gli stili in un elemento <style>, che la CSP del sito non ammette più; qui diventano un foglio di
// stile costruito con CSSOM (document.adoptedStyleSheets), che la CSP non blocca, come element.style.
// Comportamento invariato: vale lo stile del primo componente montato, sparisce con l'ultimo.
// vite.config.js lo mette al posto del pacchetto (resolve.alias).

function supportsConstructedSheets(): boolean {
  return typeof document !== 'undefined' && 'adoptedStyleSheets' in Document.prototype && 'replaceSync' in CSSStyleSheet.prototype;
}

export function stylesheetSingleton() {
  let counter = 0;
  let sheet: CSSStyleSheet | null = null;
  let tag: HTMLStyleElement | null = null;
  return {
    add(style: string) {
      if (counter === 0) {
        if (supportsConstructedSheets()) {
          sheet = new CSSStyleSheet();
          sheet.replaceSync(style);
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        } else if (typeof document !== 'undefined') {
          // Browser vecchi (Safari prima della 16.4): come l'originale; con la CSP lo stile non si
          // applica e lo scorrimento resta libero sotto la finestra, nient'altro
          tag = document.createElement('style');
          tag.appendChild(document.createTextNode(style));
          document.head.appendChild(tag);
        }
      }
      counter += 1;
    },
    remove() {
      counter -= 1;
      if (counter > 0) return;
      if (sheet) {
        const current = sheet;
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== current);
        sheet = null;
      }
      tag?.remove();
      tag = null;
    },
  };
}

export function styleHookSingleton() {
  const sheet = stylesheetSingleton();
  return function useStyle(styles: string, isDynamic?: boolean) {
    useEffect(() => {
      sheet.add(styles);
      return () => sheet.remove();
      // Come l'originale: lo stile si rifà solo se è dichiarato dinamico
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [styles && isDynamic]);
  };
}

export function styleSingleton() {
  const useStyle = styleHookSingleton();
  return function Sheet({ styles, dynamic }: { styles: string; dynamic?: boolean }) {
    useStyle(styles, dynamic);
    return null;
  };
}
