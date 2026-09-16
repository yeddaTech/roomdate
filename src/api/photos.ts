import { ApiError } from './client';

// Le foto vengono ridotte a questo lato massimo e salvate in JPEG: bastano per lo schermo
// e restano leggere da caricare anche da cellulare.
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Converte una foto scelta dall'utente in un JPEG ridimensionato. Accetta qualsiasi immagine che il
 * browser sa aprire (anche PNG, WebP o AVIF). Ricodificarla elimina i metadati EXIF, compresa la
 * posizione GPS, e applica l'orientamento corretto.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new ApiError(400, 'invalid_image', `"${file.name}" non è un'immagine.`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ApiError(400, 'invalid_image', `Impossibile aprire "${file.name}": usa una foto JPEG, PNG o WebP.`);
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new ApiError(0, 'image_processing_failed', 'Il browser non riesce a elaborare le foto.');
  }
  // Le parti trasparenti (PNG) diventano bianche invece che nere
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) {
    throw new ApiError(0, 'image_processing_failed', `Impossibile elaborare "${file.name}".`);
  }
  return blob;
}
