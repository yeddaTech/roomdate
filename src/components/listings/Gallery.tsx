import { useRef, useState } from 'react';
import { ImageOff, Images } from 'lucide-react';
import Button from '../ui/Button';
import { cn, focusRing } from '../ui/cn';
import { useLazyComponent } from '../ui/useLazyComponent';
import { useMediaQuery } from '../ui/useMediaQuery';
import { MOSAIC_QUERY, STRIP_SIZES, mosaicTile } from './photoSizes';
import { visibleIndex } from './strip';
import { useLeadImage } from './useLeadImage';

export interface Photo {
  id: number;
  url: string;
  /** Le versioni più piccole, per scaricare solo quella che serve (null per le foto più vecchie). */
  srcset?: string | null;
}

interface Props {
  photos: Photo[];
  title: string;
}

const importLightbox = () => import('./GalleryLightbox');

/**
 * Foto dell'annuncio. Sul telefono una striscia da scorrere con il dito, su desktop un mosaico;
 * toccando una foto si aprono tutte a schermo intero. Le frecce sono sempre visibili, non solo al
 * passaggio del mouse, che sul telefono non c'è.
 */
export default function Gallery({ photos, title }: Props) {
  // Solo una delle due forme nella pagina: quella nascosta scaricherebbe comunque le sue foto
  const wide = useMediaQuery(MOSAIC_QUERY);
  // Sul telefono le foto dopo la prima (fuori dallo schermo) aspettano che la prima sia arrivata
  const lead = useLeadImage(wide ? null : photos[0]?.url);
  const strip = useRef<HTMLDivElement>(null);
  const [stripIndex, setStripIndex] = useState(0);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const { Component: Lightbox, load: loadLightbox } = useLazyComponent(importLightbox);
  // Chiudendo, il focus torna alla foto da cui si era aperto
  const opener = useRef<HTMLElement | null>(null);
  const open = (i: number) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpenAt(i);
    loadLightbox();
  };

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 rounded-card bg-surface-muted text-sm font-bold text-foreground-subtle md:aspect-[21/8]">
        <ImageOff className="size-8" aria-hidden="true" />
        Nessuna foto per questo annuncio
      </div>
    );
  }

  const openLabel = (i: number) => `Apri la foto ${i + 1} di ${photos.length} a schermo intero`;
  const tiles = photos.slice(0, 5);

  return (
    <>
      {/* Telefono: da bordo a bordo, una foto per volta */}
      {!wide && (
        <div className="relative -mx-4">
          <div
            ref={strip}
            onScroll={() => setStripIndex(visibleIndex(strip.current))}
            className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {photos.map((photo, i) => (
              <button key={photo.id} type="button" onClick={() => open(i)} aria-label={openLabel(i)} className="aspect-[4/3] w-full shrink-0 snap-center bg-surface-muted">
                {(i === 0 || !lead.waiting) && (
                  <img
                    src={photo.url}
                    srcSet={photo.srcset ?? undefined}
                    sizes={STRIP_SIZES}
                    alt=""
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    decoding="async"
                    onLoad={i === 0 ? lead.settle : undefined}
                    onError={i === 0 ? lead.settle : undefined}
                    className="size-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
          {photos.length > 1 && (
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-neutral-900/70 px-2.5 py-1 text-xs font-bold text-white" aria-hidden="true">
              {stripIndex + 1} / {photos.length}
            </span>
          )}
        </div>
      )}

      {/* Desktop: mosaico */}
      {wide && (
        <div className="relative grid h-[26rem] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-card">
          {tiles.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => open(i)}
              aria-label={openLabel(i)}
              className={cn('group relative overflow-hidden bg-surface-muted', mosaicTile(tiles.length, i).span, focusRing, 'focus-visible:ring-inset focus-visible:ring-offset-0')}
            >
              <img
                src={photo.url}
                srcSet={photo.srcset ?? undefined}
                sizes={mosaicTile(tiles.length, i).sizes}
                alt=""
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding="async"
                className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
              />
            </button>
          ))}
          {photos.length > 1 && (
            <Button variant="secondary" size="sm" className="absolute bottom-4 right-4 shadow-card" onClick={() => open(0)}>
              <Images /> Tutte le foto ({photos.length})
            </Button>
          )}
        </div>
      )}

      {Lightbox && (
        <Lightbox photos={photos} title={title} openAt={openAt} onClose={() => setOpenAt(null)} returnFocus={() => opener.current?.focus()} />
      )}
    </>
  );
}
