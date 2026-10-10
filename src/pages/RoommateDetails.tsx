import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Ban, Briefcase, CalendarDays, Flag, House, MapPin, MessageCircle, Pencil, Search, UserX, Wallet } from 'lucide-react';
import { ApiError } from '../api/client';
import { useBlockUser, useMyProfile, usePublicProfile, useStartChat } from '../api/hooks';
import { occupationLabel } from '../api/options';
import type { PublicProfile } from '../api/types';
import { formatAge } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import type { AuthLocationState } from '../auth/authLocation';
import BackLink from '../components/layout/BackLink';
import ContactBar from '../components/layout/ContactBar';
import PageMeta from '../components/PageMeta';
import CompatibilityDetails from '../components/profile/CompatibilityDetails';
import LifestyleTags from '../components/profile/LifestyleTags';
import ReportDialog from '../components/ReportDialog';
import Alert from '../components/ui/Alert';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import { buttonClasses } from '../components/ui/buttonClasses';
import { cn, focusRing } from '../components/ui/cn';
import { useConfirm } from '../components/ui/confirm';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';

/** Dati essenziali del profilo, uno per riga, con l'icona. */
function Facts({ profile }: { profile: PublicProfile }) {
  const rows = [
    { icon: <CalendarDays />, label: 'Età', value: formatAge(profile.age) ?? 'Non indicata' },
    { icon: <Briefcase />, label: 'Occupazione', value: occupationLabel(profile.occupation) ?? 'Non indicata' },
    { icon: <MapPin />, label: 'Città', value: profile.city || 'Non indicata' },
    ...(profile.userType === 'cerca' ? [{ icon: <Wallet />, label: 'Budget', value: profile.budgetMax > 0 ? `Fino a ${profile.budgetMax} € al mese` : 'Non indicato' }] : []),
  ];
  return (
    <dl className="flex flex-col gap-3">
      {rows.map(({ icon, label, value }) => (
        <div key={label} className="flex items-center gap-3 [&_svg]:size-5">
          <span className="text-foreground-muted" aria-hidden="true">{icon}</span>
          <dt className="sr-only">{label}</dt>
          <dd className="text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function RoommateDetails() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const { user } = useAuth();
  // I profili privati o sospesi risultano non trovati
  const query = usePublicProfile(id);
  const me = useMyProfile({ enabled: Boolean(user) });
  const startChat = useStartChat();
  const blockUser = useBlockUser();
  const [reporting, setReporting] = useState(false);

  if (query.isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8" aria-busy="true">
        <span className="sr-only" role="status">Caricamento del profilo…</span>
        <div className="flex items-center gap-5"><Skeleton className="size-24 rounded-full" /><Skeleton className="h-10 w-48" /></div>
        <Skeleton className="mt-8 h-32 w-full rounded-card" />
      </div>
    );
  }
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <PageMeta title="Profilo non disponibile | RoomDate" noindex />
        <EmptyState
          icon={<UserX />}
          headingLevel="h1"
          title={missing ? 'Profilo non trovato' : 'Impossibile caricare il profilo'}
          description={missing ? "Potrebbe essere privato o non essere più disponibile." : query.error.message}
          action={missing
            ? <Button onClick={() => navigate('/ricerca?intent=coinquilino')}>Cerca coinquilini</Button>
            : <Button onClick={() => query.refetch()}>Riprova</Button>}
        />
      </div>
    );
  }

  const profile = query.data;
  const name = profile.firstName || 'Utente';
  const isOwn = user?.id === profile.id;

  const contact = async () => {
    if (!user) {
      toast.info('Accedi o registrati per scrivere a questa persona.');
      navigate('/accedi', { state: { from: location.pathname } satisfies AuthLocationState });
      return;
    }
    try {
      const conversationId = await startChat.mutateAsync({ targetId: profile.id });
      navigate(`/chat/${conversationId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Non è stato possibile aprire la chat.');
    }
  };

  // Dopo il blocco il profilo non è più visibile: si torna alla ricerca
  const block = async () => {
    const ok = await confirm({
      title: `Bloccare ${name}?`,
      description: 'Non potrete più scrivervi né trovarvi nelle ricerche. Puoi sbloccare in qualsiasi momento dalle Impostazioni.',
      confirmLabel: 'Blocca',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await blockUser.mutateAsync(profile.id);
      toast.success(`${name} è stato bloccato.`);
      navigate('/ricerca');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Blocco non riuscito.');
    }
  };

  const secondary = cn('inline-flex items-center gap-1.5 rounded-sm text-sm font-bold text-foreground-muted hover:text-danger disabled:opacity-50', focusRing);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 md:px-6 md:pt-6 md:pb-12">
      <PageMeta title={`${name} | RoomDate`} description={`${name} ${profile.userType === 'affitta' ? 'offre una stanza' : 'cerca una stanza'}${profile.city ? ` a ${profile.city}` : ''} su RoomDate.`} />
      <BackLink fallback="/ricerca?intent=coinquilino" />

      <header className="mt-4 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Avatar name={name} size="xl" decorative />
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">
            {name}{profile.age !== null && <span className="text-foreground-muted">, {profile.age}</span>}
          </h1>
          <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-surface-muted px-3 py-1 text-sm font-bold text-foreground-muted [&_svg]:size-4">
            {profile.userType === 'affitta' ? <><House aria-hidden="true" /> Offre una stanza</> : <><Search aria-hidden="true" /> Cerca una stanza</>}
            {profile.city && ` a ${profile.city}`}
          </p>
        </div>
      </header>

      {isOwn && (
        <Alert className="mt-6">
          Questo è il tuo profilo come lo vedono gli altri.{' '}
          <Link to="/profilo" className={cn('rounded-sm font-bold underline', focusRing)}>Modificalo</Link>
        </Alert>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="presentazione" className="flex flex-col gap-3">
            <h2 id="presentazione" className="text-xl font-bold text-foreground">Presentazione</h2>
            <p className="whitespace-pre-line leading-relaxed text-foreground-muted">
              {profile.bio || `${name} non ha ancora scritto una presentazione.`}
            </p>
          </section>

          <section aria-labelledby="stile" className="flex flex-col gap-3">
            <h2 id="stile" className="text-xl font-bold text-foreground">Stile di vita</h2>
            {profile.lifestyleTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <LifestyleTags tags={profile.lifestyleTags} className="rounded-full bg-surface-muted px-3 py-1.5 text-sm font-bold text-foreground" />
              </div>
            ) : (
              <p className="text-foreground-muted">Nessuna abitudine indicata.</p>
            )}
          </section>

          {profile.compatibility && <CompatibilityDetails compatibility={profile.compatibility} other={profile} me={me.data} />}
          {!user && (
            <p className="rounded-card bg-surface-muted p-5 text-foreground-muted">
              <Link to="/accedi" state={{ from: location.pathname } satisfies AuthLocationState} className={cn('rounded-sm font-bold text-primary hover:text-primary-hover', focusRing)}>Accedi</Link>{' '}
              per vedere cosa avete in comune: città, budget e abitudini.
            </p>
          )}

          {/* Sul telefono la colonna non c'è: i dati essenziali stanno qui */}
          <section aria-labelledby="in-breve" className="flex flex-col gap-3 lg:hidden">
            <h2 id="in-breve" className="text-xl font-bold text-foreground">In breve</h2>
            <Facts profile={profile} />
          </section>

          {user && !isOwn && (
            <div className="flex gap-6 lg:hidden">
              <button type="button" onClick={() => setReporting(true)} className={secondary}><Flag className="size-4" aria-hidden="true" /> Segnala</button>
              <button type="button" onClick={block} disabled={blockUser.isPending} className={secondary}><Ban className="size-4" aria-hidden="true" /> Blocca</button>
            </div>
          )}
        </div>

        <aside aria-label="Dati e contatto" className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-6 rounded-card border border-line bg-surface p-6 shadow-card">
            <Facts profile={profile} />
            {isOwn ? (
              <Link to="/profilo" className={buttonClasses({ variant: 'secondary', size: 'lg' })}><Pencil /> Modifica il profilo</Link>
            ) : (
              <Button size="lg" onClick={contact} loading={startChat.isPending}><MessageCircle /> Scrivi a {name}</Button>
            )}
            {user && !isOwn && (
              <div className="flex justify-center gap-6">
                <button type="button" onClick={() => setReporting(true)} className={secondary}><Flag className="size-4" aria-hidden="true" /> Segnala</button>
                <button type="button" onClick={block} disabled={blockUser.isPending} className={secondary}><Ban className="size-4" aria-hidden="true" /> Blocca</button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {!isOwn && (
        <ContactBar>
          <Button size="lg" className="w-full" onClick={contact} loading={startChat.isPending}>
            <MessageCircle /> Scrivi a {name}
          </Button>
        </ContactBar>
      )}

      {reporting && <ReportDialog target={{ userId: profile.id }} title={`Segnala ${name}`} onClose={() => setReporting(false)} />}
    </div>
  );
}
