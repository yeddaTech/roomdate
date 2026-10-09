import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Check, Clock, Lock, TriangleAlert } from 'lucide-react';
import { buildThread, type DaySection, type MessageGroup, type ThreadItem } from '../../chat/thread';
import { timeLabel } from '../../chat/time';
import { UNREADABLE } from '../../chat/useDecryptedTexts';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { cn, focusRing } from '../ui/cn';
import TypingDots from './TypingDots';

/** Entro questa distanza dal fondo si considera di essere in fondo alla conversazione. */
const BOTTOM_SLACK_PX = 80;

interface Props {
  conversationId: number;
  /** I messaggi della conversazione sono arrivati (anche se sono zero). */
  ready: boolean;
  myId: string;
  otherName: string;
  items: ThreadItem[];
  /** Ultima lettura al momento dell'apertura (vedi buildThread). */
  unreadAfter: string | null | undefined;
  typing: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => Promise<unknown>;
  onRetry: (key: string) => void;
  onDiscard: (key: string) => void;
  /** Errore del messaggio non partito, per chiave. */
  errors: Record<string, string | null>;
  /** Mostrato quando la conversazione non ha ancora messaggi. */
  empty: React.ReactNode;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Angoli delle nuvolette: quelle dello stesso gruppo si "attaccano" dal lato di chi scrive. */
function bubbleShape(mine: boolean, first: boolean) {
  return mine ? cn('rounded-2xl rounded-br-md', !first && 'rounded-tr-md') : cn('rounded-2xl rounded-bl-md', !first && 'rounded-tl-md');
}

function MessageText({ text }: { text: string }) {
  if (text === UNREADABLE) {
    return (
      <span className="inline-flex items-center gap-1.5 italic">
        <Lock className="size-3.5 shrink-0" aria-hidden="true" /> {UNREADABLE}
      </span>
    );
  }
  return <>{text}</>;
}

function Group({ group, otherName, lastSentKey, onRetry, onDiscard, errors }: {
  group: MessageGroup;
  otherName: string;
  lastSentKey: string | null;
  onRetry: (key: string) => void;
  onDiscard: (key: string) => void;
  errors: Record<string, string | null>;
}) {
  const { mine, items } = group;
  const last = items[items.length - 1];
  const author = mine ? 'Tu' : otherName;
  return (
    <li className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start')} data-testid="message-group" data-mine={mine || undefined}>
      {!mine && <Avatar name={otherName} size="sm" decorative className="mb-5" />}
      <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-0.5 md:max-w-[70%]', mine ? 'items-end' : 'items-start')}>
        <ol className={cn('flex w-full flex-col gap-0.5', mine ? 'items-end' : 'items-start')}>
          {items.map((item, index) => (
            <li key={item.key} className={cn('flex max-w-full flex-col', mine ? 'items-end' : 'items-start')} data-testid="message" data-status={item.status}>
              <p
                title={timeLabel(item.createdAt)}
                className={cn(
                  'max-w-full whitespace-pre-wrap px-4 py-2.5 text-[15px] leading-relaxed wrap-break-word',
                  bubbleShape(mine, index === 0),
                  mine ? 'bg-primary text-primary-foreground' : 'border border-line bg-surface text-foreground',
                  item.status === 'failed' && 'ring-2 ring-danger ring-offset-2 ring-offset-background',
                )}
              >
                <span className="sr-only">{author}, {timeLabel(item.createdAt)}: </span>
                <MessageText text={item.text} />
              </p>
              {item.status === 'sending' && (
                <span className="mt-1 inline-flex items-center gap-1 px-1 text-xs text-foreground-muted">
                  <Clock className="size-3" aria-hidden="true" /> Invio…
                </span>
              )}
              {item.status === 'failed' && (
                <span className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 px-1 text-xs font-bold text-danger" role="alert">
                  <span className="inline-flex items-center gap-1">
                    <TriangleAlert className="size-3.5" aria-hidden="true" />
                    {errors[item.key] ?? 'Non inviato.'}
                  </span>
                  <button type="button" onClick={() => onRetry(item.key)} className={cn('rounded-sm underline', focusRing)}>Riprova</button>
                  <button type="button" onClick={() => onDiscard(item.key)} className={cn('rounded-sm text-foreground-muted underline', focusRing)}>Elimina</button>
                </span>
              )}
            </li>
          ))}
        </ol>
        {last.status === 'sent' && (
          <span className="inline-flex items-center gap-1 px-1 text-xs text-foreground-muted" aria-hidden="true" data-testid="message-time">
            {timeLabel(last.createdAt)}
            {last.key === lastSentKey && <><span>·</span><Check className="size-3" />Inviato</>}
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * I messaggi di una conversazione: per giorno (con il giorno che resta in alto mentre si scorre),
 * in gruppi della stessa persona, con il separatore "Nuovi messaggi" prima del primo non letto.
 *
 * Scorrimento: si apre sul primo messaggio nuovo, o in fondo. Arrivando un messaggio si resta in
 * fondo se ci si era; altrimenti compare "Nuovi messaggi ↓" invece di strappare via chi sta
 * leggendo più in alto. Caricando i messaggi precedenti la posizione non salta.
 */
export default function MessageThread({
  conversationId, ready, myId, otherName, items, unreadAfter, typing, hasOlder, loadingOlder, loadOlder,
  onRetry, onDiscard, errors, empty,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [newBelow, setNewBelow] = useState(0);
  // L'ultimo messaggio arrivato dall'altro, da annunciare appena il testo è decifrato
  const [announcedKey, setAnnouncedKey] = useState<string | null>(null);
  const days: DaySection[] = useMemo(() => buildThread(items, { myId, unreadAfter }), [items, myId, unreadAfter]);

  const lastKey = items.length > 0 ? items[items.length - 1].key : null;
  // L'ultimo messaggio proprio già salvato porta "Inviato"
  const lastSentKey = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].senderId === myId) return items[i].status === 'sent' ? items[i].key : null;
    }
    return null;
  }, [items, myId]);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
    atBottom.current = true;
    setNewBelow(0);
  }, []);

  // Messaggi precedenti caricati in cima: chi legge resta sullo stesso messaggio
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const loadOlderKeepingPlace = useCallback(() => {
    const node = scroller.current;
    if (node) anchor.current = { height: node.scrollHeight, top: node.scrollTop };
    return loadOlder();
  }, [loadOlder]);
  const firstKey = items.length > 0 ? items[0].key : null;
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node || !anchor.current) return;
    node.scrollTop = node.scrollHeight - anchor.current.height + anchor.current.top;
    anchor.current = null;
  }, [firstKey]);

  // Apertura della conversazione (sul primo messaggio nuovo, altrimenti in fondo) e messaggi che
  // arrivano in fondo: si seguono se si era in fondo o se li ha scritti chi guarda
  const seen = useRef<{ conversationId: number | null; lastKey: string | null }>({ conversationId: null, lastKey: null });
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node || !ready) return;
    const before = seen.current;
    seen.current = { conversationId, lastKey };
    if (before.conversationId !== conversationId) {
      // Il separatore poco sotto il bordo, così si vede anche l'ultimo messaggio già letto
      const divider = node.querySelector<HTMLElement>('[data-unread-divider]');
      node.scrollTop = divider
        ? node.scrollTop + divider.getBoundingClientRect().top - node.getBoundingClientRect().top - 48
        : node.scrollHeight;
      atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < BOTTOM_SLACK_PX;
      setNewBelow(0);
      setAnnouncedKey(null);
      return;
    }
    if (before.lastKey === lastKey || lastKey === null) return;
    const last = items[items.length - 1];
    if (last.senderId !== myId && last.status === 'sent') setAnnouncedKey(last.key);
    // Senza animazione: con più messaggi in arrivo uno scorrimento morbido non finirebbe in tempo
    if (atBottom.current || last.senderId === myId) scrollToBottom(false);
    else setNewBelow((n) => n + 1);
  }, [ready, conversationId, lastKey, items, myId, scrollToBottom]);

  // "Sta scrivendo" in fondo resta visibile a chi è in fondo
  useLayoutEffect(() => {
    if (typing && atBottom.current) scrollToBottom(false);
  }, [typing, scrollToBottom]);

  // La tastiera che si apre o il campo che cresce rimpiccioliscono l'area: chi era in fondo ci resta
  useEffect(() => {
    const node = scroller.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (atBottom.current) node.scrollTop = node.scrollHeight;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // In cima si caricano da soli i messaggi precedenti
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasOlder || loadingOlder || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadOlderKeepingPlace();
    }, { root: scroller.current });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasOlder, loadingOlder, loadOlderKeepingPlace]);

  const announced = announcedKey ? items.find((item) => item.key === announcedKey) : undefined;
  const announcement = announced && announced.text !== '…' ? `Nuovo messaggio da ${otherName}: ${announced.text}` : '';

  const onScroll = () => {
    const node = scroller.current;
    if (!node) return;
    atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < BOTTOM_SLACK_PX;
    if (atBottom.current && newBelow > 0) setNewBelow(0);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Raggiungibile con la tastiera, per scorrere i messaggi con le frecce */}
      <div
        ref={scroller}
        onScroll={onScroll}
        role="region"
        aria-label={`Messaggi con ${otherName}`}
        tabIndex={0}
        data-testid="message-scroller"
        className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-4 md:px-6', focusRing, 'focus-visible:ring-inset focus-visible:ring-offset-0')}
      >
        {hasOlder && (
          <div ref={sentinel} className="flex justify-center pb-4">
            <Button variant="secondary" size="sm" loading={loadingOlder} onClick={() => loadOlderKeepingPlace()}>
              Messaggi precedenti
            </Button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="my-auto">{empty}</div>
        ) : (
          // Finché non si sa dove aprire (separatore, fondo) i messaggi non si mostrano: niente lampo in cima
          <div className={cn('mt-auto flex flex-col gap-4', !ready && 'invisible')}>
            {days.map((day) => (
              <section key={day.key} aria-labelledby={`giorno-${conversationId}-${day.key}`} className="flex flex-col gap-3">
                <h3 id={`giorno-${conversationId}-${day.key}`} className="sticky top-0 z-10 self-center rounded-full border border-line bg-surface/95 px-3 py-1 text-xs font-bold text-foreground-muted shadow-card backdrop-blur-sm">
                  {day.label}
                </h3>
                <ol className="flex flex-col gap-3">
                  {day.groups.map((group) => [
                    group.unreadStart && (
                      <li key={`nuovi-${group.key}`} data-unread-divider className="flex items-center gap-3 text-xs font-bold text-primary-soft-foreground">
                        <span className="h-px flex-1 bg-primary/40" aria-hidden="true" />
                        Nuovi messaggi
                        <span className="h-px flex-1 bg-primary/40" aria-hidden="true" />
                      </li>
                    ),
                    <Group key={group.key} group={group} otherName={otherName} lastSentKey={lastSentKey} onRetry={onRetry} onDiscard={onDiscard} errors={errors} />,
                  ])}
                </ol>
              </section>
            ))}
          </div>
        )}

        {typing && (
          <div className="mt-3 flex items-end gap-2" data-testid="typing-bubble">
            <Avatar name={otherName} size="sm" decorative />
            <span className="rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3.5 text-foreground-muted">
              <TypingDots />
            </span>
          </div>
        )}
      </div>

      {newBelow > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className={cn('absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background shadow-overlay animate-fade-in', focusRing)}
        >
          <ArrowDown className="size-4" aria-hidden="true" />
          {newBelow === 1 ? '1 nuovo messaggio' : `${newBelow} nuovi messaggi`}
        </button>
      )}

      {/* Annuncia ai lettori di schermo i messaggi che arrivano, non quelli già presenti */}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  );
}
