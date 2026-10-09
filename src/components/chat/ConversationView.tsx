import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Ban, CircleCheck, Flag, MessageCircle } from 'lucide-react';
import type { Conversation } from '../../api/types';
import { LISTING_QUESTIONS, nameOf } from '../../chat/conversation';
import type { ThreadItem } from '../../chat/thread';
import Alert from '../ui/Alert';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { cn, focusRing } from '../ui/cn';
import Composer from './Composer';
import ConversationListing from './ConversationListing';
import MessageThread from './MessageThread';
import TypingDots from './TypingDots';

const finePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

interface Props {
  conversation: Conversation;
  myId: string;
  items: ThreadItem[];
  errors: Record<string, string | null>;
  messages: {
    ready: boolean;
    error: string | null;
    retry: () => void;
    hasOlder: boolean;
    loadingOlder: boolean;
    loadOlder: () => Promise<unknown>;
  };
  unreadAfter: string | null | undefined;
  typing: boolean;
  /** La tastiera del telefono è aperta: la scheda dell'annuncio lascia spazio ai messaggi. */
  keyboardOpen: boolean;
  draft: string;
  onDraftChange: (text: string) => void;
  onBack: () => void;
  onSend: (text: string) => void;
  onTyping: () => void;
  onRetry: (key: string) => void;
  onDiscard: (key: string) => void;
  onReport: () => void;
  onToggleBlock: () => void;
  blockPending: boolean;
}

/** Perché nella conversazione non si può più scrivere, o null se si può. */
function closedReason(conversation: Conversation): string | null {
  const name = nameOf(conversation);
  if (!conversation.other) return 'Questo account non esiste più: la conversazione resta leggibile, ma non puoi più scrivere.';
  if (conversation.other.unavailable) return 'Questo account non è più disponibile: non puoi inviargli messaggi.';
  if (conversation.blocked === 'by_me') return `Hai bloccato ${name}: nessuno dei due può scrivere in questa conversazione.`;
  if (conversation.blocked === 'by_other') return 'Non puoi più inviare messaggi in questa conversazione.';
  return null;
}

export default function ConversationView({
  conversation, myId, items, errors, messages, unreadAfter, typing, keyboardOpen, draft, onDraftChange,
  onBack, onSend, onTyping, onRetry, onDiscard, onReport, onToggleBlock, blockPending,
}: Props) {
  const { other, listing } = conversation;
  const name = nameOf(conversation);
  const closed = closedReason(conversation);
  const heading = useRef<HTMLHeadingElement>(null);
  const closedNow = useRef(closed);
  useEffect(() => {
    closedNow.current = closed;
  });

  // Aperta la conversazione: con mouse e tastiera il cursore va nel campo (lo mette Composer), con
  // il dito no, perché aprirebbe la tastiera prima di aver letto. Il titolo prende il focus, così
  // i lettori di schermo partono da qui. Solo all'apertura, non quando cambia lo stato di blocco
  useEffect(() => {
    if (closedNow.current || !finePointer()) heading.current?.focus({ preventScroll: true });
  }, [conversation.id]);

  const subtitle = listing ? listing.title : conversation.listingDeleted ? 'Annuncio eliminato' : 'Chat diretta';
  const wroteSomething = items.some((item) => item.senderId === myId);
  const suggestions = !closed && listing && !listing.mine && !wroteSomething && messages.ready ? LISTING_QUESTIONS : [];

  return (
    <>
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-2 py-2.5 md:gap-3 md:px-6 md:py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Torna alle conversazioni"
          className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-surface-muted md:hidden [&_svg]:size-5', focusRing)}
        >
          <ArrowLeft aria-hidden="true" />
        </button>
        <Avatar name={name} size="md" decorative />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 ref={heading} tabIndex={-1} className="truncate text-lg leading-tight font-bold text-foreground outline-none">
            {other?.profileVisible ? (
              <Link to={`/coinquilino/${other.id}`} className={cn('rounded-sm hover:underline', focusRing)}>{name}</Link>
            ) : name}
          </h2>
          <p className="truncate text-sm text-foreground-muted" data-testid="conversation-subtitle">
            {typing ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-primary-soft-foreground">
                sta scrivendo <TypingDots />
              </span>
            ) : subtitle}
          </p>
          <span className="sr-only" aria-live="polite">{typing ? `${name} sta scrivendo` : ''}</span>
        </div>
        {other && (
          <div className="flex shrink-0 items-center">
            <Button variant="ghost" size="sm" onClick={onReport} className="px-3 text-foreground-muted hover:text-danger">
              <Flag aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Segnala</span>
            </Button>
            {conversation.blocked !== 'by_other' && (
              <Button variant="ghost" size="sm" onClick={onToggleBlock} loading={blockPending} className="px-3 text-foreground-muted hover:text-danger">
                {conversation.blocked === 'by_me' ? <CircleCheck aria-hidden="true" /> : <Ban aria-hidden="true" />}
                <span className="sr-only sm:not-sr-only">{conversation.blocked === 'by_me' ? 'Sblocca' : 'Blocca'}</span>
              </Button>
            )}
          </div>
        )}
      </header>

      {!keyboardOpen && <ConversationListing listing={listing} deleted={conversation.listingDeleted} />}

      {messages.error && !messages.ready ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <Alert tone="danger" title="Impossibile caricare i messaggi">{messages.error}</Alert>
          <Button variant="secondary" onClick={messages.retry}>Riprova</Button>
        </div>
      ) : (
        <MessageThread
          conversationId={conversation.id}
          ready={messages.ready}
          myId={myId}
          otherName={name}
          items={items}
          unreadAfter={unreadAfter}
          typing={typing}
          hasOlder={messages.hasOlder}
          loadingOlder={messages.loadingOlder}
          loadOlder={messages.loadOlder}
          onRetry={onRetry}
          onDiscard={onDiscard}
          errors={errors}
          empty={messages.ready ? (
            <div className="mx-auto flex max-w-xs flex-col items-center gap-2 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-foreground-muted" aria-hidden="true">
                <MessageCircle className="size-6" />
              </span>
              <p className="font-bold text-foreground">Scrivi il primo messaggio a {name}</p>
              <p className="text-sm text-foreground-muted">
                {listing && !listing.mine ? 'Presentati e chiedi quello che vuoi sapere sulla stanza.' : 'Presentati e racconta cosa cerchi.'}
              </p>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-foreground-muted" role="status">Caricamento dei messaggi…</p>
          )}
        />
      )}

      {closed ? (
        <div data-testid="conversation-closed" className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-line bg-surface px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-foreground-muted md:px-6">
          <p>{closed}</p>
          {conversation.blocked === 'by_me' && (
            <Button variant="secondary" size="sm" onClick={onToggleBlock} loading={blockPending}>Sblocca</Button>
          )}
        </div>
      ) : (
        <Composer
          key={conversation.id}
          recipient={name}
          initialText={draft}
          onDraftChange={onDraftChange}
          onSend={onSend}
          onTyping={onTyping}
          suggestions={suggestions}
          autoFocus
        />
      )}
    </>
  );
}
