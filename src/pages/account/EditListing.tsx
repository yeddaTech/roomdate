import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, Eye, EyeOff, Trash2 } from 'lucide-react';
import { ApiError } from '../../api/client';
import { useDeleteListing, useListing, useSetListingActive, useUpdateListing } from '../../api/hooks';
import type { ListingDetail } from '../../api/types';
import { BasicsFields, DetailsFields } from '../../components/listings/ListingFields';
import ListingPhotos from '../../components/listings/ListingPhotos';
import PageMeta from '../../components/PageMeta';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/buttonClasses';
import Card from '../../components/ui/Card';
import { cn, focusRing } from '../../components/ui/cn';
import { useConfirm } from '../../components/ui/confirm';
import EmptyState from '../../components/ui/EmptyState';
import Skeleton from '../../components/ui/Skeleton';
import { listingInput, listingSchema, listingValues, type ListingValues } from '../../forms/listingRules';
import { useLeaveGuard } from '../../forms/useLeaveGuard';

function DetailsForm({ listing }: { listing: ListingDetail }) {
  const update = useUpdateListing();
  const form = useForm<ListingValues>({ resolver: zodResolver(listingSchema), mode: 'onTouched', defaultValues: listingValues(listing) });
  const { handleSubmit, reset, setError, setFocus, formState: { isDirty, isSubmitting } } = form;
  useLeaveGuard(isDirty && !isSubmitting);

  const save = handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync({ id: listing.id, input: listingInput(values) });
      reset(listingValues(saved));
      toast.success('Modifiche salvate.');
    } catch (err) {
      if (err instanceof ApiError && err.fields.length > 0) {
        for (const { field, message } of err.fields) setError(field as keyof ListingValues, { type: 'server', message });
        setFocus(err.fields[0].field as keyof ListingValues);
      } else {
        toast.error(err instanceof Error ? err.message : 'Salvataggio non riuscito. Riprova.');
      }
    }
  });

  return (
    <form noValidate onSubmit={save} className="flex flex-col gap-5">
      <BasicsFields form={form} />
      <DetailsFields form={form} />
      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
        {isDirty && <Button variant="ghost" size="lg" onClick={() => reset()} disabled={isSubmitting}>Annulla le modifiche</Button>}
        <Button type="submit" size="lg" loading={isSubmitting}>Salva le modifiche</Button>
      </div>
    </form>
  );
}

/** Modifica di un proprio annuncio (modulo M2.7): pubblicazione, foto, dati ed eliminazione. */
export default function EditListing() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  // Eliminato l'annuncio, la pagina non deve richiederlo di nuovo mentre torna all'elenco
  const [deleting, setDeleting] = useState(false);
  const query = useListing(id, { enabled: !deleting });
  const setActive = useSetListingActive();
  const remove = useDeleteListing();
  const listing = query.data;

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <span className="sr-only" role="status">Caricamento dell’annuncio…</span>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-48 rounded-card" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    );
  }
  // Gli annunci degli altri, o quelli che non esistono più, non si modificano da qui
  if (query.isError || !listing?.isOwner) {
    const missing = !query.isError || (query.error instanceof ApiError && query.error.status === 404);
    return (
      <EmptyState
        headingLevel="h1"
        title={missing ? 'Annuncio non trovato' : 'Impossibile caricare l’annuncio'}
        description={missing ? 'Non esiste più, oppure non è tuo.' : query.error?.message}
        action={missing
          ? <Link to="/annunci" className={buttonClasses({ variant: 'secondary' })}>I miei annunci</Link>
          : <Button onClick={() => query.refetch()}>Riprova</Button>}
      />
    );
  }

  const toggle = async () => {
    try {
      await setActive.mutateAsync({ id: listing.id, active: !listing.isActive });
      toast.success(listing.isActive ? 'Annuncio ritirato: non compare più nelle ricerche.' : 'Annuncio pubblicato: ora compare nelle ricerche.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operazione non riuscita.');
    }
  };

  const destroy = async () => {
    const ok = await confirm({
      title: `Eliminare «${listing.title}»?`,
      description: 'Verranno cancellate anche le foto. Le conversazioni con chi ti ha scritto restano. Non si può annullare.',
      confirmLabel: 'Elimina annuncio',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await remove.mutateAsync(listing.id);
      toast.success('Annuncio eliminato.');
      navigate('/annunci', { replace: true });
    } catch (err) {
      setDeleting(false);
      toast.error(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title={`Modifica: ${listing.title} | RoomDate`} noindex />
      <Link to="/annunci" className={cn('inline-flex items-center gap-1.5 self-start rounded-sm text-sm font-bold text-foreground-muted hover:text-foreground [&_svg]:size-4', focusRing)}>
        <ArrowLeft aria-hidden="true" /> I miei annunci
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Modifica l’annuncio</h1>
          <p className="mt-2 truncate text-foreground-muted">{listing.title}</p>
        </div>
        <Link to={`/dettagli/${listing.id}`} className={buttonClasses({ variant: 'secondary' })}>Vedi l’annuncio</Link>
      </div>

      {listing.removed ? (
        <Alert tone="danger" title="Rimosso dalla moderazione">
          Questo annuncio viola i Termini di utilizzo: non è più visibile agli altri e non si può modificare. Puoi solo eliminarlo.
        </Alert>
      ) : (
        <>
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:p-6" data-testid="publication">
            <div>
              <h2 className="text-lg font-bold text-foreground">{listing.isActive ? 'Pubblicato' : 'Non pubblicato'}</h2>
              <p className="text-sm text-foreground-muted">
                {listing.isActive ? 'Compare nelle ricerche e chi lo vede può scriverti.' : 'Lo vedi solo tu: non compare nelle ricerche.'}
              </p>
            </div>
            <Button variant={listing.isActive ? 'secondary' : 'primary'} onClick={toggle} loading={setActive.isPending}>
              {listing.isActive ? <><EyeOff aria-hidden="true" /> Ritira l’annuncio</> : <><Eye aria-hidden="true" /> Pubblica l’annuncio</>}
            </Button>
          </Card>

          <Card className="flex flex-col gap-4 md:p-8">
            <h2 className="text-xl font-bold text-foreground">Foto</h2>
            <ListingPhotos listing={listing} />
          </Card>

          <Card className="flex flex-col gap-5 md:p-8">
            <h2 className="text-xl font-bold text-foreground">Dati dell’annuncio</h2>
            <DetailsForm key={listing.id} listing={listing} />
          </Card>
        </>
      )}

      <Card className="flex flex-col gap-4 border-danger/30 sm:flex-row sm:items-center sm:justify-between md:p-6">
        <div>
          <h2 className="text-lg font-bold text-foreground">Elimina l’annuncio</h2>
          <p className="text-sm text-foreground-muted">Si cancellano anche le foto. Non si può annullare.</p>
        </div>
        <Button variant="danger" onClick={destroy} loading={remove.isPending}><Trash2 aria-hidden="true" /> Elimina</Button>
      </Card>
    </div>
  );
}
