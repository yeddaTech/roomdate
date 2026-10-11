// Strisce di foto a scorrimento orizzontale: nella galleria del telefono e a schermo intero.

/** Quale foto si vede in una striscia a scorrimento orizzontale (una foto larga quanto la striscia). */
export function visibleIndex(track: HTMLElement | null): number {
  return track && track.clientWidth > 0 ? Math.round(track.scrollLeft / track.clientWidth) : 0;
}
