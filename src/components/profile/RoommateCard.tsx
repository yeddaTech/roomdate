import { MapPin, MessageCircle, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { occupationLabel } from '../../api/options';
import type { Roommate } from '../../api/types';
import { formatAge } from '../../api/users';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { buttonClasses } from '../ui/buttonClasses';
import CompatibilityList from './CompatibilityList';
import LifestyleTags from './LifestyleTags';

interface Props {
  roommate: Roommate;
  onContact: (id: string) => void;
  contacting?: boolean;
}

/** Scheda di chi cerca casa: chi è, dove e con che budget, cosa avete in comune. */
export default function RoommateCard({ roommate, onContact, contacting = false }: Props) {
  const name = roommate.firstName || 'Utente';
  const details = [formatAge(roommate.age), occupationLabel(roommate.occupation)].filter(Boolean).join(' · ');

  return (
    <article data-testid="roommate-card" className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-4">
        <Avatar name={name} size="lg" decorative />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-foreground">{name}</h2>
          {details && <p className="text-sm text-foreground-muted">{details}</p>}
          {roommate.city && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-foreground-muted">
              <MapPin className="size-4 shrink-0" aria-hidden="true" /> {roommate.city}
            </p>
          )}
        </div>
      </div>

      <p className="line-clamp-3 text-sm leading-relaxed text-foreground-muted">
        {roommate.bio || 'Nessuna presentazione.'}
      </p>

      {roommate.lifestyleTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <LifestyleTags tags={roommate.lifestyleTags} limit={4} className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-bold text-foreground-muted" />
        </div>
      )}

      {roommate.budgetMax > 0 && (
        <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Wallet className="size-4 text-foreground-muted" aria-hidden="true" /> Budget fino a {roommate.budgetMax} € al mese
        </p>
      )}

      {roommate.compatibility && <CompatibilityList compatibility={roommate.compatibility} />}

      <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
        <Link to={`/coinquilino/${roommate.id}`} className={buttonClasses({ variant: 'secondary' })} aria-label={`Profilo di ${name}`}>
          Profilo
        </Link>
        <Button onClick={() => onContact(roommate.id)} loading={contacting} aria-label={`Scrivi a ${name}`}>
          <MessageCircle /> Scrivi
        </Button>
      </div>
    </article>
  );
}
