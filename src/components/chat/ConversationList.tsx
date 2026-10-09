import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { House, MessagesSquare, Search, SearchX } from 'lucide-react';
import type { Conversation } from '../../api/types';
import { nameOf } from '../../chat/conversation';
import { shortDateLabel } from '../../chat/time';
import Alert from '../ui/Alert';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { buttonClasses } from '../ui/buttonClasses';
import { cn, focusRing } from '../ui/cn';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';
import LoadMore from '../search/LoadMore';

interface Props {
  conversations: Conversation[];
  activeId: number | null;
  /** Sul telefono l'elenco si vede (nessuna conversazione aperta). */
  shown: boolean;
  status: 'pending' | 'error' | 'success';
  errorMessage?: string;
  onRetry: () => void;
  /** Anteprima dell'ultimo messaggio (già decifrato), o un testo che dice perché non c'è. */
  previewOf: (conversation: Conversation) => string;
  /** La conversazione in cui l'altro sta scrivendo (si sa solo per quella aperta). */
  typingIn: number | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isNextPageError: boolean;
  fetchNextPage: () => unknown;
}

function Row({ conversation, active, preview, typing }: { conversation: Conversation; active: boolean; preview: string; typing: boolean }) {
  const name = nameOf(conversation);
  const unread = conversation.unreadCount;
  return (
    <li>
      <Link
        to={`/chat/${conversation.id}`}
        state={{ fromList: true }}
        aria-current={active ? 'page' : undefined}
        data-testid="conversation"
        className={cn(
          'relative flex gap-3 px-4 py-3.5 transition-colors md:px-5',
          active ? 'bg-primary-soft' : 'hover:bg-surface-muted',
          focusRing, 'focus-visible:ring-inset focus-visible:ring-offset-0',
        )}
      >
        {active && <span className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-primary" aria-hidden="true" />}
        <Avatar name={name} size="md" decorative />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn('truncate text-foreground', unread > 0 ? 'font-extrabold' : 'font-bold')}>{name}</span>
            <span className={cn('shrink-0 text-xs', unread > 0 ? 'font-bold text-primary-soft-foreground' : 'text-foreground-muted')}>
              {shortDateLabel(conversation.lastMessage?.createdAt ?? conversation.updatedAt)}
            </span>
          </span>
          {conversation.listing && (
            <span className="flex items-center gap-1 truncate text-xs font-bold text-foreground-muted">
              <House className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{conversation.listing.title}</span>
            </span>
          )}
          <span className="flex items-center justify-between gap-2">
            <span className={cn('truncate text-sm', typing ? 'font-bold text-primary-soft-foreground' : unread > 0 ? 'font-bold text-foreground' : 'text-foreground-muted')}>
              {typing ? 'Sta scrivendo…' : preview}
            </span>
            {unread > 0 && (
              <span data-testid="unread-badge" className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                {unread}
                <span className="sr-only">{unread === 1 ? ' messaggio non letto' : ' messaggi non letti'}</span>
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Elenco delle conversazioni, dalla più recente, con la ricerca per nome, annuncio o testo. */
export default function ConversationList({
  conversations, activeId, shown, status, errorMessage, onRetry, previewOf, typingIn,
  hasNextPage, isFetchingNextPage, isNextPageError, fetchNextPage,
}: Props) {
  const [query, setQuery] = useState('');
  const searchId = useId();

  // Sul telefono l'elenco sparisce mentre una conversazione è aperta: tornando, resta dov'era.
  // Al ritorno ricompare anche la barra in basso e l'elenco cambia altezza: la posizione si
  // riapplica finché non è raggiunta, e intanto gli scorrimenti non la sovrascrivono
  const scroller = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);
  const restoring = useRef(false);
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node || !shown || savedScroll.current <= 0) return undefined;
    const apply = () => {
      node.scrollTop = savedScroll.current;
      restoring.current = Math.abs(node.scrollTop - savedScroll.current) >= 1;
    };
    apply();
    if (!restoring.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => restoring.current && apply());
    observer.observe(node);
    const stop = setTimeout(() => {
      restoring.current = false;
      observer.disconnect();
    }, 1000);
    return () => {
      restoring.current = false;
      observer.disconnect();
      clearTimeout(stop);
    };
  }, [shown]);
  const onScroll = () => {
    const node = scroller.current;
    if (node && node.offsetParent !== null && !restoring.current) savedScroll.current = node.scrollTop;
  };
  const search = query.trim().toLocaleLowerCase('it');
  const visible = search
    ? conversations.filter((c) => [nameOf(c), c.listing?.title ?? '', previewOf(c)].some((text) => text.toLocaleLowerCase('it').includes(search)))
    : conversations;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 border-b border-line px-4 pt-5 pb-4 md:px-5">
        <h1 className="font-display text-2xl font-bold text-foreground">Messaggi</h1>
        {conversations.length > 0 && (
          <div className="relative">
            <label htmlFor={searchId} className="sr-only">Cerca nelle conversazioni</label>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-foreground-subtle" aria-hidden="true" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome o annuncio"
              autoComplete="off"
              className={cn('h-11 w-full rounded-full border border-control bg-background pr-4 pl-10 text-base text-foreground placeholder:text-foreground-subtle md:text-sm', focusRing, 'focus-visible:ring-offset-0')}
            />
          </div>
        )}
      </div>

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="conversation-scroller">
        {status === 'pending' ? (
          <ul aria-busy="true" aria-label="Caricamento delle conversazioni">
            {[0, 1, 2, 3, 4].map((n) => (
              <li key={n} className="flex gap-3 px-4 py-3.5 md:px-5">
                <Skeleton className="size-11 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col justify-center gap-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </li>
            ))}
          </ul>
        ) : status === 'error' ? (
          <div className="flex flex-col items-start gap-3 p-4 md:p-5">
            <Alert tone="danger" title="Impossibile caricare le conversazioni">{errorMessage}</Alert>
            <Button variant="secondary" onClick={onRetry}>Riprova</Button>
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare />}
            title="Nessuna conversazione"
            description="Quando scrivi a qualcuno da un annuncio o da un profilo, o qualcuno ti scrive, la conversazione compare qui."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/ricerca" className={buttonClasses({ size: 'sm' })}>Cerca una stanza</Link>
                <Link to="/ricerca?intent=coinquilino" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>Trova coinquilini</Link>
              </div>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState icon={<SearchX />} title="Nessun risultato" description={`Nessuna conversazione corrisponde a «${query.trim()}».`} />
        ) : (
          <>
            <ul aria-label="Conversazioni">
              {visible.map((conversation) => (
                <Row
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === activeId}
                  preview={previewOf(conversation)}
                  typing={typingIn === conversation.id}
                />
              ))}
            </ul>
            <LoadMore
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              isError={isNextPageError}
              fetchNextPage={fetchNextPage}
              label="Altre conversazioni"
            />
          </>
        )}
      </div>
    </div>
  );
}
