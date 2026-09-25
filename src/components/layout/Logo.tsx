import { Link } from 'react-router-dom';
import { cn } from '../ui/cn';

/** Il marchio: rimanda sempre alla home. */
export default function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <Link to="/" className={cn('inline-flex items-center gap-2 rounded-control font-display text-2xl font-bold tracking-tight', className)} aria-label="RoomDate, vai alla home">
      <span className={onDark ? 'text-white' : 'text-foreground'}>Room</span>
      <span className="-ml-2 bg-brand bg-clip-text text-transparent">Date</span>
    </Link>
  );
}
