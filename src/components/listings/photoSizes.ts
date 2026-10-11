// Quanto è larga ogni foto nella pagina, per l'attributo sizes: con lo srcset il browser scarica la
// versione più piccola che basta allo schermo (modulo M2.8). Sono misurate sulle pagine: se cambia
// l'impaginazione (colonne, margini, larghezza massima) vanno aggiornate qui.

/** Schede degli annunci: una colonna sul telefono, due dal tablet, tre o quattro sul desktop. */
export const CARD_SIZES = '(min-width: 1280px) 290px, (min-width: 1024px) 450px, (min-width: 640px) 50vw, 100vw';

/** Da questa larghezza la galleria è un mosaico; sotto è una striscia da bordo a bordo. */
export const MOSAIC_QUERY = '(min-width: 768px)';
export const STRIP_SIZES = '100vw';

// Il mosaico è largo quanto la pagina meno i margini (48 px), al massimo 1104 px (max-w-6xl):
// 4 colonne con 8 px tra l'una e l'altra
const MOSAIC_SIZES = {
  full: '(min-width: 1152px) 1104px, calc(100vw - 48px)',
  half: '(min-width: 1152px) 548px, calc(50vw - 28px)',
  quarter: '(min-width: 1152px) 270px, calc(25vw - 18px)',
};

/**
 * Posto della foto i nel mosaico di count foto (al massimo 5): una sola occupa tutto, la prima
 * metà, le altre si dividono il resto.
 */
export function mosaicTile(count: number, i: number): { span: string; sizes: string } {
  if (count === 1) return { span: 'col-span-4 row-span-2', sizes: MOSAIC_SIZES.full };
  if (count === 2 || i === 0) return { span: 'col-span-2 row-span-2', sizes: MOSAIC_SIZES.half };
  if (count === 3 || (count === 4 && i === 1)) return { span: 'col-span-2', sizes: MOSAIC_SIZES.half };
  return { span: '', sizes: MOSAIC_SIZES.quarter };
}
