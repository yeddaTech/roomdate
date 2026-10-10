import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { ApiError } from '../../api/client';
import { MAX_LISTING_IMAGES } from '../../api/listings';
import { useDeleteListingImage, useUploadListingPhoto } from '../../api/hooks';
import type { ListingDetail } from '../../api/types';
import Alert from '../ui/Alert';
import { cn, focusRing } from '../ui/cn';
import { useConfirm } from '../ui/confirm';
import Spinner from '../ui/Spinner';

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Si è verificato un errore. Riprova.';
}

/**
 * Foto di un annuncio: elenco, caricamento (più file alla volta) ed eliminazione. La prima foto è
 * la copertina, quella che si vede negli elenchi.
 */
export default function ListingPhotos({ listing }: { listing: ListingDetail }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadListingPhoto();
  const deleteImage = useDeleteListingImage();
  const confirm = useConfirm();
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

  const handleDelete = async (imageId: number, index: number) => {
    if (!(await confirm({ title: `Eliminare la foto ${index + 1}?`, confirmLabel: 'Elimina foto', tone: 'danger' }))) return;
    setError('');
    try {
      await deleteImage.mutateAsync({ listingId: listing.id, imageId });
    } catch (err) {
      setError(messageOf(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground-muted">
        {listing.images.length} di {MAX_LISTING_IMAGES} foto. La prima è la copertina, quella che si vede nei risultati della ricerca.
      </p>

      {error && <Alert tone="danger">{error}</Alert>}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Foto dell’annuncio">
        {listing.images.map((image, index) => (
          <li key={image.id} className="relative aspect-[4/3] overflow-hidden rounded-control border border-line bg-surface-muted">
            <img src={image.url} alt={`Foto ${index + 1}`} className="size-full object-cover" />
            {index === 0 && (
              <span className="absolute top-2 left-2 rounded-full bg-neutral-950/75 px-2.5 py-1 text-xs font-bold text-white">Copertina</span>
            )}
            {/* Sopra le foto i colori restano fissi: devono staccare su qualsiasi immagine */}
            <button
              type="button"
              onClick={() => handleDelete(image.id, index)}
              disabled={isBusy}
              aria-label={`Elimina la foto ${index + 1}`}
              className={cn('absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-full bg-neutral-950/75 text-white transition-colors hover:bg-red-700 disabled:opacity-50 [&_svg]:size-4', focusRing)}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </li>
        ))}

        {remaining > 0 && (
          <li className="aspect-[4/3]">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isBusy}
              className={cn(
                'flex size-full flex-col items-center justify-center gap-1.5 rounded-control border-2 border-dashed border-control text-sm font-bold text-foreground-muted transition-colors',
                'hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-6',
                focusRing,
              )}
            >
              {progress ? (
                <>
                  <Spinner />
                  <span role="status">Caricamento {Math.min(progress.done + 1, progress.total)} di {progress.total}…</span>
                </>
              ) : (
                <>
                  <ImagePlus aria-hidden="true" />
                  Aggiungi foto
                </>
              )}
            </button>
          </li>
        )}
      </ul>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" data-testid="listing-photo-input" />
      <p className="text-xs text-foreground-muted">Prima di caricarle le ridimensioniamo e togliamo i dati di posizione salvati dal telefono.</p>
    </div>
  );
}
