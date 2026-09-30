import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { ChevronLeft, ChevronRight, ImageOff, Images, X } from 'lucide-react';
import Button from '../ui/Button';
import { cn, focusRing } from '../ui/cn';

export interface Photo {
  id: number;
  url: string;
}

interface Props {
  photos: Photo[];
  title: string;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Quale foto si vede in una striscia a scorrimento orizzontale (una foto larga quanto la striscia). */
function visibleIndex(track: HTMLElement | null): number {
  return track && track.clientWidth > 0 ? Math.round(track.scrollLeft / track.clientWidth) : 0;
}

// Mosaico su desktop: la prima foto grande, le altre intorno, secondo quante sono
function tileClass(count: number, i: number): string {
  if (count === 1) return 'col-span-4 row-span-2';
  if (count === 2) return 'col-span-2 row-span-2';
  if (i === 0) return 'col-span-2 row-span-2';
  if (count === 3) return 'col-span-2';
  if (count === 4 && i === 1) return 'col-span-2';
  return '';
}

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
        <div
          ref={track}
          onScroll={() => setIndex(visibleIndex(track.current))}
          className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, i) => (
            <div key={photo.id} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-20">
              <img
                src={photo.url}
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
 * Foto dell'annuncio. Sul telefono una striscia da scorrere con il dito, su desktop un mosaico;
 * toccando una foto si aprono tutte a schermo intero. Le frecce sono sempre visibili, non solo al
 * passaggio del mouse, che sul telefono non c'è.
 */
export default function Gallery({ photos, title }: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const [stripIndex, setStripIndex] = useState(0);
  const [openAt, setOpenAt] = useState<number | null>(null);
  // Chiudendo, il focus torna alla foto da cui si era aperto (senza un DialogTrigger Radix non lo sa)
  const opener = useRef<HTMLElement | null>(null);
  const open = (i: number) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpenAt(i);
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
      <div className="relative -mx-4 md:hidden">
        <div
          ref={strip}
          onScroll={() => setStripIndex(visibleIndex(strip.current))}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, i) => (
            <button key={photo.id} type="button" onClick={() => open(i)} aria-label={openLabel(i)} className="aspect-[4/3] w-full shrink-0 snap-center bg-surface-muted">
              <img src={photo.url} alt="" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" className="size-full object-cover" />
            </button>
          ))}
        </div>
        {photos.length > 1 && (
          <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-neutral-900/70 px-2.5 py-1 text-xs font-bold text-white" aria-hidden="true">
            {stripIndex + 1} / {photos.length}
          </span>
        )}
      </div>

      {/* Desktop: mosaico */}
      <div className="relative hidden h-[26rem] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-card md:grid">
        {tiles.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => open(i)}
            aria-label={openLabel(i)}
            className={cn('group relative overflow-hidden bg-surface-muted', tileClass(tiles.length, i), focusRing, 'focus-visible:ring-inset focus-visible:ring-offset-0')}
          >
            <img src={photo.url} alt="" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" />
          </button>
        ))}
        {photos.length > 1 && (
          <Button variant="secondary" size="sm" className="absolute bottom-4 right-4 shadow-card" onClick={() => open(0)}>
            <Images /> Tutte le foto ({photos.length})
          </Button>
        )}
      </div>

      <DialogPrimitive.Root open={openAt !== null} onOpenChange={(isOpen) => { if (!isOpen) setOpenAt(null); }}>
        <DialogPrimitive.Portal>
          {/* Scuro in entrambi i temi: si guardano le foto */}
          <DialogPrimitive.Content
            onCloseAutoFocus={(e) => { e.preventDefault(); opener.current?.focus(); }}
            className="fixed inset-0 z-[2001] bg-neutral-950 text-white outline-none animate-fade-in"
          >
            <DialogPrimitive.Title className="sr-only">Foto di «{title}»</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Scorri o usa le frecce per passare da una foto all&apos;altra.</DialogPrimitive.Description>
            {openAt !== null && <LightboxBody photos={photos} title={title} start={openAt} />}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
