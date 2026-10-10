import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowRight, Eye, EyeOff, House, Search } from 'lucide-react';
import { ApiError } from '../../api/client';
import { useMyProfile, useUpdateMyProfile } from '../../api/hooks';
import { CITIES, OCCUPATIONS } from '../../api/options';
import type { Profile } from '../../api/types';
import { latestAdultBirthdate } from '../../api/users';
import PageMeta from '../../components/PageMeta';
import LifestyleTagsPicker from '../../components/profile/LifestyleTagsPicker';
import Alert from '../../components/ui/Alert';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { cn, focusRing } from '../../components/ui/cn';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import Skeleton from '../../components/ui/Skeleton';
import { profileCompleteness, type CompletenessItem } from '../../forms/profileCompleteness';
import { MAX_BIO_LENGTH, bio, birthdate, budget, budgetValue, occupation, optionalCity } from '../../forms/rules';
import { useLeaveGuard } from '../../forms/useLeaveGuard';
import { z } from '../../forms/zod';

const schema = z.object({
  userType: z.enum(['cerca', 'affitta'], 'Scegli cosa cerchi su RoomDate'),
  city: optionalCity,
  birthdate,
  budgetMax: budget,
  occupation,
  bio,
  lifestyleTags: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

function valuesFrom(profile: Profile): Values {
  return {
    userType: profile.userType,
    city: profile.city,
    birthdate: profile.birthdate,
    budgetMax: profile.budgetMax > 0 ? String(profile.budgetMax) : '',
    occupation: profile.occupation,
    bio: profile.bio,
    lifestyleTags: profile.lifestyleTags,
  };
}

const roleClass = cn(
  'flex cursor-pointer items-center gap-3 rounded-control border border-control bg-surface p-4 font-bold text-foreground transition-colors duration-150 [&_svg]:size-5',
  'hover:border-foreground has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-soft-foreground',
  'has-focus-visible:ring-2 has-focus-visible:ring-focus has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background',
);

/** Cosa manca al profilo per essere utile a chi lo guarda: ogni voce porta al campo da compilare. */
function Completeness({ items, percent, onPick }: { items: CompletenessItem[]; percent: number; onPick: (field: CompletenessItem['field']) => void }) {
  const missing = items.filter((item) => !item.done);
  if (missing.length === 0) return null;
  return (
    <Card className="flex flex-col gap-4 md:p-6" data-testid="profile-completeness">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Il tuo profilo è completo al {percent}%</h2>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Completezza del profilo" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-sm text-foreground-muted">
        Chi cerca casa o un coinquilino si fida di più di un profilo completo, e con città e budget ti mostriamo cosa avete in comune. Mancano:
      </p>
      <ul className="flex flex-wrap gap-2">
        {missing.map((item) => (
          <li key={item.field}>
            <button
              type="button"
              onClick={() => onPick(item.field)}
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border border-control px-3.5 text-sm font-bold text-foreground hover:border-foreground [&_svg]:size-4', focusRing)}
            >
              {item.label} <ArrowRight aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateMyProfile();
  const tagsId = useId();
  const form = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched', defaultValues: valuesFrom(profile) });
  const { register, control, handleSubmit, watch, reset, setError, setFocus, formState: { errors, isDirty, isSubmitting } } = form;
  const role = watch('userType');
  const bioLength = watch('bio').length;
  useLeaveGuard(isDirty && !isSubmitting);

  const save = async (values: Values) => {
    try {
      const saved = await update.mutateAsync({
        userType: values.userType,
        city: values.city,
        birthdate: values.birthdate,
        // Chi offre una stanza non ha un budget
        budgetMax: values.userType === 'cerca' ? budgetValue(values.budgetMax) : 0,
        occupation: values.occupation,
        bio: values.bio.trim(),
        lifestyleTags: values.lifestyleTags,
        // La visibilità si cambia in Impostazioni → Privacy
        isPublic: profile.isPublic,
      });
      reset(valuesFrom(saved));
      toast.success('Profilo salvato.');
    } catch (err) {
      if (err instanceof ApiError && err.fields.length > 0) {
        for (const { field, message } of err.fields) setError(field as keyof Values, { type: 'server', message });
        setFocus(err.fields[0].field as keyof Values);
      } else {
        toast.error(err instanceof Error ? err.message : 'Salvataggio non riuscito. Riprova.');
      }
    }
  };

  const { items, percent } = profileCompleteness(profile);
  const pick = (field: CompletenessItem['field']) => {
    if (field === 'lifestyleTags') {
      const group = document.getElementById(tagsId);
      group?.scrollIntoView({ block: 'center' });
      group?.querySelector('input')?.focus({ preventScroll: true });
    } else {
      setFocus(field);
    }
  };

  return (
    <>
      <Completeness items={items} percent={percent} onPick={pick} />
      <Card className="md:p-8">
        <form noValidate onSubmit={handleSubmit(save)} className="flex flex-col gap-8">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-lg font-bold text-foreground">Cosa fai su RoomDate</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={roleClass}>
                <input type="radio" value="cerca" className="sr-only" {...register('userType')} />
                <Search aria-hidden="true" /> Cerco una stanza
              </label>
              <label className={roleClass}>
                <input type="radio" value="affitta" className="sr-only" {...register('userType')} />
                <House aria-hidden="true" /> Offro una stanza
              </label>
            </div>
            {role !== profile.userType && (
              <p className="text-sm text-foreground-muted" role="status">
                {role === 'affitta'
                  ? 'Dopo il salvataggio potrai pubblicare annunci da «I miei annunci».'
                  : 'Gli annunci che hai già pubblicato restano: potrai sempre modificarli o ritirarli.'}
              </p>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-5">
            <legend className="mb-1 text-lg font-bold text-foreground">I tuoi dati</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Città" error={errors.city?.message} hint={role === 'cerca' ? 'Dove cerchi casa.' : undefined}>
                <Select {...register('city')}>
                  <option value="">Non indicata</option>
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Data di nascita" error={errors.birthdate?.message} hint="Gli altri vedono solo l’età.">
                <Input type="date" autoComplete="bday" min="1900-01-01" max={latestAdultBirthdate()} {...register('birthdate')} />
              </Field>
              {role === 'cerca' && (
                <Field label="Budget massimo al mese (€)" error={errors.budgetMax?.message} hint="Serve a mostrarti le stanze adatte e chi ha un budget simile.">
                  <Input inputMode="numeric" autoComplete="off" placeholder="Es. 500" {...register('budgetMax')} />
                </Field>
              )}
              <Field label="Occupazione" error={errors.occupation?.message}>
                <Select {...register('occupation')}>
                  <option value="">Preferisco non indicarla</option>
                  {OCCUPATIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field
              label="Presentazione"
              error={errors.bio?.message}
              hint={`Due righe su di te: i tuoi orari, cosa cerchi in una casa. ${bioLength}/${MAX_BIO_LENGTH}`}
            >
              <Textarea rows={5} maxLength={MAX_BIO_LENGTH} {...register('bio')} />
            </Field>
          </fieldset>

          <fieldset className="flex flex-col gap-3" id={tagsId}>
            <legend className="mb-1 text-lg font-bold text-foreground">Stile di vita</legend>
            <p className="text-sm text-foreground-muted">Le abitudini in comune compaiono a chi guarda il tuo profilo.</p>
            <Controller
              name="lifestyleTags"
              control={control}
              render={({ field }) => <LifestyleTagsPicker value={field.value} onChange={field.onChange} />}
            />
            {errors.lifestyleTags && <p role="alert" className="text-sm font-bold text-danger">{errors.lifestyleTags.message}</p>}
          </fieldset>

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
            {isDirty && <Button variant="ghost" size="lg" onClick={() => reset()} disabled={isSubmitting}>Annulla le modifiche</Button>}
            <Button type="submit" size="lg" loading={isSubmitting}>Salva il profilo</Button>
          </div>
        </form>
      </Card>
    </>
  );
}

/** Il proprio profilo (modulo M2.7): come ti vedono gli altri e i dati da cambiare. */
export default function ProfilePage() {
  const query = useMyProfile();
  const profile = query.data;

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="Il tuo profilo | RoomDate" noindex />
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Il tuo profilo</h1>
        <p className="mt-2 text-foreground-muted">Quello che scrivi qui lo vedono gli altri, tranne cognome, email e data di nascita.</p>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <span className="sr-only" role="status">Caricamento del profilo…</span>
          <Skeleton className="h-28 rounded-card" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      ) : query.isError || !profile ? (
        <Alert tone="danger" title="Impossibile caricare il profilo">
          {query.error?.message} <Button variant="secondary" size="sm" className="mt-3" onClick={() => query.refetch()}>Riprova</Button>
        </Alert>
      ) : (
        <>
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-center md:p-6">
            <Avatar name={profile.firstName} size="lg" decorative />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-xl font-bold text-foreground">{profile.firstName} {profile.lastName}</p>
              <p className="truncate text-sm text-foreground-muted">{profile.email}</p>
            </div>
            {profile.isPublic ? (
              <Link to={`/coinquilino/${profile.id}`} className={cn('inline-flex items-center gap-1.5 rounded-sm text-sm font-bold text-primary hover:text-primary-hover [&_svg]:size-4', focusRing)}>
                <Eye aria-hidden="true" /> Come ti vedono gli altri
              </Link>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-sm text-foreground-muted [&_svg]:size-4">
                <EyeOff aria-hidden="true" /> Profilo privato.{' '}
                <Link to="/impostazioni#privacy" className={cn('rounded-sm font-bold text-primary hover:text-primary-hover', focusRing)}>Cambia</Link>
              </p>
            )}
          </Card>
          <ProfileForm key={profile.id} profile={profile} />
        </>
      )}
    </div>
  );
}
