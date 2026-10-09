import { cn } from '../ui/cn';

/** I tre puntini di "sta scrivendo". Solo decorativi: il testo per i lettori di schermo è altrove. */
export default function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-hidden="true">
      <span className="size-1.5 animate-typing rounded-full bg-current" />
      <span className="size-1.5 animate-typing rounded-full bg-current [animation-delay:150ms]" />
      <span className="size-1.5 animate-typing rounded-full bg-current [animation-delay:300ms]" />
    </span>
  );
}
