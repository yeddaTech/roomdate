import { ApiError } from './client';

// Le foto vengono ridotte a questo lato massimo e salvate in JPEG: bastano per lo schermo
// e restano leggere da caricare anche da cellulare.
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;
// Versioni ridotte (larghezza in pixel), le stesse che il server accetta (storage.VariantWidths):
// schede e miniature scaricano queste invece dell'originale, molto più leggere sul telefono
export const VARIANT_WIDTHS = [480, 960];
const VARIANT_QUALITY = 0.8;

/** Una foto pronta da caricare: l'originale ridotto a 1600 px e le versioni più piccole. */
export interface PreparedImage {
  main: Blob;
  /** Solo quelle più strette dell'originale: una foto piccola non ne ha bisogno. */
  variants: { width: number; blob: Blob }[];
}

function draw(bitmap: ImageBitmap, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ApiError(0, 'image_processing_failed', 'Il browser non riesce a elaborare le foto.');
  // Le parti trasparenti (PNG) diventano bianche invece che nere
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

function jpeg(canvas: HTMLCanvasElement, quality: number, name: string): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (
    blob ? resolve(blob) : reject(new ApiError(0, 'image_processing_failed', `Impossibile elaborare "${name}".`))
  ), 'image/jpeg', quality));
}

/**
 * Converte una foto scelta dall'utente in JPEG ridimensionati: l'originale fino a 1600 px e le
 * versioni ridotte. Accetta qualsiasi immagine che il browser sa aprire (anche PNG, WebP o AVIF).
 * Ricodificarla elimina i metadati EXIF, compresa la posizione GPS, e applica l'orientamento corretto.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) {
    throw new ApiError(400, 'invalid_image', `"${file.name}" non è un'immagine.`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ApiError(400, 'invalid_image', `Impossibile aprire "${file.name}": usa una foto JPEG, PNG o WebP.`);
  }

  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const main = await jpeg(draw(bitmap, width, height), JPEG_QUALITY, file.name);

    const variants: PreparedImage['variants'] = [];
    for (const target of VARIANT_WIDTHS.filter((w) => w < width)) {
      const blob = await jpeg(draw(bitmap, target, Math.max(1, Math.round((height * target) / width))), VARIANT_QUALITY, file.name);
      variants.push({ width: target, blob });
    }
    return { main, variants };
  } finally {
    bitmap.close();
  }
}
