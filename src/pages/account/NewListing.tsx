import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Eye } from 'lucide-react';
import { ApiError } from '../../api/client';
import { useCreateListing, useListing, useSetListingActive, useUpdateListing } from '../../api/hooks';
import { useAuth } from '../../auth/AuthContext';
import ListingCard from '../../components/listings/ListingCard';
import { BasicsFields, DetailsFields } from '../../components/listings/ListingFields';
import ListingPhotos from '../../components/listings/ListingPhotos';
import PageMeta from '../../components/PageMeta';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/buttonClasses';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import StepIndicator from '../../components/ui/StepIndicator';
import {
  BASICS_FIELDS,
  emptyListingValues,
  listingInput,
  listingSchema,
  listingValues,
  type ListingValues,
} from '../../forms/listingRules';
import { useLeaveGuard } from '../../forms/useLeaveGuard';

const STEPS = ['La stanza', 'Descrizione', 'Foto', 'Pubblicazione'];

function Frame({ title, description, headingRef, children, footer }: {
  title: string;
  description: ReactNode;
  headingRef: Ref<HTMLHeadingElement>;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold text-foreground outline-none md:text-3xl">{title}</h2>
        <p className="mt-2 text-foreground-muted">{description}</p>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
      <div className="mt-2 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">{footer}</div>
    </div>
  );
}

/**
 * Creazione guidata di un annuncio (modulo M2.7): la stanza, la descrizione, le foto, la
 * pubblicazione. Il passo è nell'indirizzo (?passo=2), così "Indietro" del browser torna al passo
 * precedente. Alla fine del secondo passo l'annuncio si salva come bozza, che vede solo chi lo ha
 * scritto: le foto si aggiungono prima che compaia nelle ricerche, e se si esce a metà lo si
 * ritrova in "I miei annunci".
 */
export default function NewListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const createdId = Number(params.get('annuncio')) || null;
  const created = useListing(createdId ?? 0, { enabled: createdId !== null });
  const listing = created.data?.isOwner ? created.data : null;

  const form = useForm<ListingValues>({ resolver: zodResolver(listingSchema), mode: 'onTouched', defaultValues: emptyListingValues() });
  const { handleSubmit, clearErrors, reset, setError, setFocus, formState: { isDirty } } = form;
  const createListing = useCreateListing();
  const updateListing = useUpdateListing();
  const setActive = useSetListingActive();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Tornando su un annuncio già salvato (ricaricamento, "Indietro"), il modulo riparte dai suoi dati
  const loadedFor = useRef<number | null>(null);
  useEffect(() => {
    if (listing && loadedFor.current !== listing.id) {
      loadedFor.current = listing.id;
      reset(listingValues(listing));
    }
  }, [listing, reset]);

  // Senza annuncio salvato si può stare solo nei primi due passi
  const requested = Number(params.get('passo')) || 1;
  const step = Math.min(Math.max(requested, 1), createdId ? 4 : 2);
  const go = (next: number, id: number | null = createdId) => {
    const search: Record<string, string> = {};
    if (id) search.annuncio = String(id);
    if (next > 1) search.passo = String(next);
    setParams(search);
  };

  // Il titolo del passo prende il focus, così i lettori di schermo annunciano il passo nuovo
  const heading = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  // Uscire prima di aver salvato fa perdere i dati scritti; dopo, la bozza è salva
  useLeaveGuard(isDirty && createdId === null);

  if (user?.userType !== 'affitta') {
    return (
      <EmptyState
        headingLevel="h1"
        title="Per pubblicare un annuncio"
        description="Scegli «Offro una stanza» nel tuo profilo: poi potrai pubblicare le tue stanze."
        action={<Link to="/profilo" className={buttonClasses()}>Vai al profilo</Link>}
      />
    );
  }

  // Si controlla tutto il modulo con handleSubmit, non solo i campi del passo: dopo un tentativo non
  // riuscito i campi si ricontrollano mentre si scrive, non all'uscita. Un errore che sparisse
  // all'uscita da un campo sposterebbe "Avanti" proprio mentre lo si clicca (anomalia vista in M2.3).
  // Gli errori dei passi successivi non contano qui, e non si mostrano prima del tempo
  const nextFromBasics = handleSubmit(() => go(2), (errors) => {
    if (BASICS_FIELDS.some((field) => errors[field])) return;
    clearErrors(['description', 'amenities']);
    go(2);
  });

  // Fine del secondo passo: la bozza si crea (o si aggiorna, se c'era già) e si passa alle foto
  const saveDraft = handleSubmit(async (values) => {
    setFormError(null);
    setSaving(true);
    try {
      if (listing) {
        await updateListing.mutateAsync({ id: listing.id, input: listingInput(values) });
        go(3);
      } else {
        const draft = await createListing.mutateAsync({ input: listingInput(values), draft: true });
        reset(values);
        go(3, draft.id);
      }
    } catch (err) {
      if (err instanceof ApiError && err.fields.length > 0) {
        for (const { field, message } of err.fields) setError(field as keyof ListingValues, { type: 'server', message });
        const first = err.fields[0].field;
        // L'errore può essere di un campo del primo passo: si torna lì
        if ((BASICS_FIELDS as readonly string[]).includes(first)) go(1);
        setTimeout(() => setFocus(first as keyof ListingValues));
      } else {
        setFormError(err instanceof Error ? err.message : 'Salvataggio non riuscito. Riprova.');
      }
    } finally {
      setSaving(false);
    }
  }, () => {
    // Un campo del primo passo non valido (per esempio dopo un ricaricamento): si torna lì
    if (Object.keys(form.formState.errors).some((field) => (BASICS_FIELDS as readonly string[]).includes(field))) go(1);
  });

  const publish = async () => {
    if (!listing) return;
    try {
      await setActive.mutateAsync({ id: listing.id, active: true });
      toast.success('Annuncio pubblicato: ora compare nelle ricerche.');
      navigate(`/dettagli/${listing.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Pubblicazione non riuscita.');
    }
  };

  const later = () => {
    toast.success('Annuncio salvato come bozza: lo ritrovi in «I miei annunci».');
    navigate('/annunci');
  };

  const back = (to: number) => <Button variant="ghost" size="lg" onClick={() => go(to)}><ArrowLeft aria-hidden="true" /> Indietro</Button>;

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="Pubblica un annuncio | RoomDate" noindex />
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Pubblica un annuncio</h1>
        <p className="mt-2 text-foreground-muted">Finché non lo pubblichi lo vedi solo tu.</p>
      </div>
      <StepIndicator steps={STEPS} current={step} label="Passi della pubblicazione" />

      {createdId !== null && (created.isError || (created.data && !created.data.isOwner)) && (
        <Alert tone="danger" title="Impossibile caricare l’annuncio">
          {created.error?.message ?? 'Annuncio non trovato.'} <Link to="/annunci" className="font-bold underline">I miei annunci</Link>
        </Alert>
      )}

      <Card className="md:p-8">
        {step === 1 && (
          <form noValidate onSubmit={nextFromBasics}>
            <Frame
              title="La stanza"
              description="Dove si trova, che tipo di stanza è e quanto costa."
              headingRef={heading}
              footer={<><Link to="/annunci" className={buttonClasses({ variant: 'ghost', size: 'lg' })}>Annulla</Link><Button type="submit" size="lg">Avanti <ArrowRight aria-hidden="true" /></Button></>}
            >
              <BasicsFields form={form} />
            </Frame>
          </form>
        )}

        {step === 2 && (
          <form noValidate onSubmit={(e) => { e.preventDefault(); saveDraft(); }}>
            <Frame
              title="Descrizione e servizi"
              description="Racconta com’è la casa e cosa offre. Poi salviamo la bozza e aggiungi le foto."
              headingRef={heading}
              footer={<>{back(1)}<Button type="submit" size="lg" loading={saving}>Salva e aggiungi le foto <ArrowRight aria-hidden="true" /></Button></>}
            >
              {formError && <Alert tone="danger">{formError}</Alert>}
              <DetailsFields form={form} />
            </Frame>
          </form>
        )}

        {step === 3 && (
          <Frame
            title="Le foto"
            description="Fino a 8 foto. Chi cerca casa le guarda per prime: luce, letto, armadio, bagno e cucina."
            headingRef={heading}
            footer={<>{back(2)}<Button size="lg" onClick={() => go(4)} disabled={!listing}>Avanti <ArrowRight aria-hidden="true" /></Button></>}
          >
            {listing ? <ListingPhotos listing={listing} /> : <p className="text-foreground-muted" role="status">Caricamento…</p>}
          </Frame>
        )}

        {step === 4 && (
          <Frame
            title="Tutto pronto?"
            description="Così comparirà nei risultati della ricerca. Puoi sempre modificarlo o ritirarlo."
            headingRef={heading}
            footer={(
              <>
                {back(3)}
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button variant="secondary" size="lg" onClick={later} disabled={!listing}>La pubblico più tardi</Button>
                  <Button size="lg" onClick={publish} loading={setActive.isPending} disabled={!listing}><Eye aria-hidden="true" /> Pubblica l’annuncio</Button>
                </div>
              </>
            )}
          >
            {listing ? (
              <>
                {listing.images.length === 0 && (
                  <Alert tone="warning">Non hai aggiunto foto: puoi pubblicarlo lo stesso, ma senza foto chi cerca casa difficilmente scrive.</Alert>
                )}
                <div className="max-w-sm">
                  <ListingCard listing={listing} showSave={false} headingLevel="h3" />
                </div>
              </>
            ) : <p className="text-foreground-muted" role="status">Caricamento…</p>}
          </Frame>
        )}
      </Card>
    </div>
  );
}
