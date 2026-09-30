import { Heart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSetListingSaved } from '../../api/hooks';
import type { ListingSummary } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import type { AuthLocationState } from '../../auth/authLocation';
import { buttonClasses } from '../ui/buttonClasses';
import { cn, focusRing } from '../ui/cn';

interface Props {
  listing: Pick<ListingSummary, 'id' | 'title' | 'saved'>;
  /** "icon": il cuore sulla foto delle schede; "full": pulsante con il testo (dettaglio). */
  variant?: 'icon' | 'full';
  /** Dopo il cambio riuscito, es. per offrire "Annulla" nella pagina dei preferiti. */
  onSaved?: (saved: boolean) => void;
  className?: string;
}

/**
 * Salva un annuncio nei preferiti. Il cuore è un interruttore (aria-pressed): nel nome c'è il
 * titolo, così in un elenco si capisce quale annuncio si salva. Senza sessione porta all'accesso.
 */
export default function SaveButton({ listing, variant = 'icon', onSaved, className }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const setSaved = useSetListingSaved();

  const toggle = () => {
    if (!user) {
      toast.info('Accedi per salvare gli annunci nei preferiti.');
      navigate('/accedi', { state: { from: location.pathname + location.search } satisfies AuthLocationState });
      return;
    }
    const saved = !listing.saved;
    setSaved.mutate({ id: listing.id, saved }, {
      onSuccess: () => onSaved?.(saved),
      onError: (error) => toast.error(error.message),
    });
  };

  if (variant === 'full') {
    return (
      <button type="button" onClick={toggle} className={buttonClasses({ variant: 'secondary', size: 'lg', className: cn('w-full', className) })}>
        <Heart className={cn(listing.saved && 'fill-current text-primary')} aria-hidden="true" />
        {listing.saved ? 'Togli dai preferiti' : 'Salva nei preferiti'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listing.saved}
      aria-label={`Salva «${listing.title}» nei preferiti`}
      title={listing.saved ? 'Togli dai preferiti' : 'Salva nei preferiti'}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-full bg-surface/90 text-foreground shadow-card backdrop-blur-sm transition-transform duration-150 hover:scale-105 active:scale-95 [&_svg]:size-5',
        listing.saved && 'text-primary',
        focusRing,
        className,
      )}
    >
      <Heart className={cn(listing.saved && 'fill-current')} aria-hidden="true" />
    </button>
  );
}
