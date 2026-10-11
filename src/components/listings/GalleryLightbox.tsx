import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn, focusRing } from '../ui/cn';
import type { Photo } from './Gallery';
import { visibleIndex } from './strip';

interface Props {
  photos: Photo[];
  title: string;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Il contenuto a schermo intero: parte dalla foto scelta, poi si scorre con il dito, le frecce o la tastiera. */
function LightboxBody({ photos, title, start }: Props & { start: number }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);

  // All'apertura si parte dalla foto scelta, senza animazione
  useLayoutEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
  }, [start]);

  const go = (target: number) => {
    const el = track.current;
    const next = Math.max(0, Math.min(photos.length - 1, target));
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
    setIndex(next);
  };
  // Frecce della tastiera ovunque sia il focus mentre la galleria è aperta
  const goRef = useRef(go);
  goRef.current = go;
  const indexRef = useRef(index);
  indexRef.current = index;
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goRef.current(indexRef.current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goRef.current(indexRef.current - 1); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  // A fine corsa le frecce restano focalizzabili (aria-disabled): con disabled il browser toglierebbe loro il focus
  const arrow = 'absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 aria-disabled:opacity-30 aria-disabled:hover:bg-white/15 sm:inline-flex [&_svg]:size-6';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-sm font-bold" aria-live="polite">{index + 1} di {photos.length}</p>
        <DialogPrimitive.Close className={cn('inline-flex size-11 items-center justify-center rounded-full hover:bg-white/15 [&_svg]:size-6', focusRing, 'focus-visible:ring-offset-black')} aria-label="Chiudi le foto">
          <X />
        </DialogPrimitive.Close>
      </div>
      <div className="relative min-h-0 flex-1">
        <button type="button" onClick={() => go(index - 1)} aria-disabled={index === 0} aria-label="Foto precedente" className={cn(arrow, 'left-4', focusRing, 'focus-visible:ring-offset-black')}>
          <ChevronLeft />
        </button>
        {/* Raggiungibile con Tab come ogni zona che scorre; le frecce funzionano comunque ovunque */}
        <div
          ref={track}
          tabIndex={0}
          role="region"
          aria-label="Foto: usa le frecce per scorrerle"
          onScroll={() => setIndex(visibleIndex(track.current))}
          className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, i) => (
            <div key={photo.id} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-20">
              <img
                src={photo.url}
                srcSet={photo.srcset ?? undefined}
                sizes="100vw"
                alt={`Foto ${i + 1} di ${photos.length}: ${title}`}
                loading={Math.abs(i - start) <= 1 ? 'eager' : 'lazy'}
                decoding="async"
                className="max-h-full max-w-full rounded-control object-contain"
              />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => go(index + 1)} aria-disabled={index === photos.length - 1} aria-label="Foto successiva" className={cn(arrow, 'right-4', focusRing, 'focus-visible:ring-offset-black')}>
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}

/**
 * Le foto a schermo intero, aperte dalla galleria. Il codice è in un file a parte (con Radix
 * Dialog): la pagina dell'annuncio si apre senza aspettarlo.
 */
export default function GalleryLightbox({ photos, title, openAt, onClose, returnFocus }: Props & {
  /** La foto da cui partire, null se chiusa. */
  openAt: number | null;
  onClose: () => void;
  /** Chiudendo, il focus torna alla foto da cui si era aperto (senza un DialogTrigger Radix non lo sa). */
  returnFocus: () => void;
}) {
  return (
    <DialogPrimitive.Root open={openAt !== null} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogPrimitive.Portal>
        {/* Scuro in entrambi i temi: si guardano le foto */}
        <DialogPrimitive.Content
          onCloseAutoFocus={(e) => { e.preventDefault(); returnFocus(); }}
          className="fixed inset-0 z-[2001] bg-neutral-950 text-white outline-none animate-fade-in"
        >
          <DialogPrimitive.Title className="sr-only">Foto di «{title}»</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Scorri o usa le frecce per passare da una foto all&apos;altra.</DialogPrimitive.Description>
          {openAt !== null && <LightboxBody photos={photos} title={title} start={openAt} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
