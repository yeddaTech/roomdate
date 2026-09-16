import { useRef, useState, type ChangeEvent } from 'react';
import { ApiError } from '../../api/client';
import { MAX_LISTING_IMAGES } from '../../api/listings';
import { useDeleteListingImage, useUploadListingPhoto } from '../../api/hooks';
import type { ListingDetail } from '../../api/types';

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Si è verificato un errore. Riprova.';
}

/** Foto di un annuncio: elenco, caricamento (più file alla volta) ed eliminazione. La prima foto è la copertina. */
export default function ListingPhotos({ listing }: { listing: ListingDetail }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadListingPhoto();
  const deleteImage = useDeleteListingImage();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const remaining = MAX_LISTING_IMAGES - listing.images.length;
  const isBusy = progress !== null || deleteImage.isPending;

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setError('');

    const selected = files.slice(0, remaining);
    const errors: string[] = [];
    if (files.length > remaining) {
      errors.push(`Puoi aggiungere ancora ${remaining} foto: le altre sono state ignorate.`);
    }

    setProgress({ done: 0, total: selected.length });
    for (const [i, file] of selected.entries()) {
      try {
        await upload.mutateAsync({ listingId: listing.id, file });
      } catch (err) {
        errors.push(messageOf(err));
        // Senza storage o senza connessione è inutile provare con i file successivi
        if (err instanceof ApiError && (err.code === 'uploads_unavailable' || err.status === 0)) break;
      }
      setProgress({ done: i + 1, total: selected.length });
    }
    setProgress(null);
    setError(errors.join(' '));
  };

  const handleDelete = async (imageId: number) => {
    if (!window.confirm('Eliminare questa foto?')) return;
    setError('');
    try {
      await deleteImage.mutateAsync({ listingId: listing.id, imageId });
    } catch (err) {
      setError(messageOf(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-between items-baseline gap-2">
        <h3 className="text-lg font-extrabold text-neutral-900">Foto</h3>
        <span className="text-sm text-neutral-500 font-medium">{listing.images.length} di {MAX_LISTING_IMAGES} · la prima è la copertina</span>
      </div>

      {error && <div className="p-4 rounded-2xl font-bold bg-rose-50 text-rose-700 border border-rose-200 text-sm">⚠️ {error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {listing.images.map((image, index) => (
          <div key={image.id} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200 group">
            <img src={image.url} alt={`Foto ${index + 1} dell'annuncio`} className="w-full h-full object-cover" />
            {index === 0 && <span className="absolute top-2 left-2 bg-white/90 text-neutral-900 text-[11px] font-bold px-2 py-1 rounded-full">Copertina</span>}
            <button
              type="button"
              onClick={() => handleDelete(image.id)}
              disabled={isBusy}
              aria-label={`Elimina la foto ${index + 1}`}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-neutral-900/80 text-white font-bold hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50"
            >
              ×
            </button>
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
            className="aspect-[4/3] rounded-2xl border-2 border-dashed border-neutral-300 hover:border-orange-400 text-neutral-500 hover:text-orange-500 font-bold text-sm flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {progress ? (
              <span>Caricamento {Math.min(progress.done + 1, progress.total)} di {progress.total}...</span>
            ) : (
              <>
                <span className="text-2xl">＋</span>
                <span>Aggiungi foto</span>
              </>
            )}
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" data-testid="listing-photo-input" />
      <p className="text-xs text-neutral-400 font-medium">Le foto vengono ridimensionate e private dei dati di posizione prima del caricamento.</p>
    </div>
  );
}
