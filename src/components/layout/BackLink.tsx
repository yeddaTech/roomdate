import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn, focusRing } from '../ui/cn';

/**
 * "Indietro" verso la pagina precedente del sito (es. la ricerca con i suoi filtri e il punto in cui
 * si era). Se la pagina è stata aperta da un link esterno non c'è una pagina precedente del sito:
 * si va a fallback invece di uscire.
 */
export default function BackLink({ fallback, label = 'Indietro' }: { fallback: string; label?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <button
      type="button"
      onClick={() => (location.key !== 'default' ? navigate(-1) : navigate(fallback))}
      className={cn('inline-flex items-center gap-1.5 rounded-full py-2 pr-3 text-sm font-bold text-foreground-muted hover:text-foreground', focusRing)}
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> {label}
    </button>
  );
}
