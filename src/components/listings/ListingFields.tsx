import type { UseFormReturn } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { AMENITIES, CITIES } from '../../api/options';
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH, MAX_ZONE_LENGTH, availabilityRange, type ListingValues } from '../../forms/listingRules';
import { cn } from '../ui/cn';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { amenityIcon } from './amenityIcons';

type Form = UseFormReturn<ListingValues>;

const choiceClass = cn(
  'inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-control bg-surface px-4 text-sm font-bold text-foreground-muted transition-colors duration-150',
  'hover:border-foreground hover:text-foreground [&_svg]:size-4',
  'has-checked:border-foreground has-checked:bg-foreground has-checked:text-background',
  'has-focus-visible:ring-2 has-focus-visible:ring-focus has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background',
);

/** Domanda con poche risposte (tipo di stanza, spese): radio native con l'aspetto di pulsanti. */
function Choices({ legend, name, options, form, error }: {
  legend: string;
  name: 'roomType' | 'billsIncluded';
  options: { value: string; label: string }[];
  form: Form;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2" aria-invalid={error ? true : undefined}>
      <legend className="mb-1.5 text-sm font-bold text-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className={choiceClass}>
            <input type="radio" value={option.value} className="sr-only" {...form.register(name)} />
            {option.label}
          </label>
        ))}
      </div>
      {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
    </fieldset>
  );
}

/** La stanza: titolo, dove, che tipo, quanto costa e da quando è libera. */
export function BasicsFields({ form }: { form: Form }) {
  const { register, formState: { errors }, watch } = form;
  const { min, max } = availabilityRange();
  const titleLength = watch('title').length;
  return (
    <>
      <Field label="Titolo" error={errors.title?.message} hint={`Cosa la rende interessante, in poche parole. ${titleLength}/${MAX_TITLE_LENGTH}`}>
        <Input placeholder="Es. Singola luminosa vicino alla metro" maxLength={MAX_TITLE_LENGTH} autoComplete="off" {...register('title')} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Città" error={errors.city?.message}>
          <Select {...register('city')}>
            <option value="">Scegli…</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Zona o quartiere" error={errors.zone?.message} hint="Facoltativa. Non serve l’indirizzo esatto.">
          <Input placeholder="Es. Isola" maxLength={MAX_ZONE_LENGTH} autoComplete="off" {...register('zone')} />
        </Field>
      </div>
      <Choices
        legend="Tipo di stanza"
        name="roomType"
        form={form}
        error={errors.roomType?.message}
        options={[{ value: 'singola', label: 'Singola' }, { value: 'doppia', label: 'Doppia' }]}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Prezzo al mese (€)" error={errors.price?.message}>
          <Input inputMode="numeric" placeholder="Es. 550" autoComplete="off" {...register('price')} />
        </Field>
        <Field label="Disponibile dal" error={errors.availableFrom?.message} hint="Facoltativa: lasciala vuota se è libera da subito.">
          <Input type="date" min={min} max={max} {...register('availableFrom')} />
        </Field>
      </div>
      <Choices
        legend="Le spese (luce, gas, acqua) sono incluse nel prezzo?"
        name="billsIncluded"
        form={form}
        error={errors.billsIncluded?.message}
        options={[{ value: 'true', label: 'Sì, incluse' }, { value: 'false', label: 'No, a parte' }]}
      />
    </>
  );
}

/** Descrizione e servizi. */
export function DetailsFields({ form }: { form: Form }) {
  const { register, control, formState: { errors }, watch } = form;
  const descriptionLength = watch('description').length;
  return (
    <>
      <Field
        label="Descrizione"
        error={errors.description?.message}
        hint={`La casa, i coinquilini, i mezzi vicini, cosa è compreso. ${descriptionLength}/${MAX_DESCRIPTION_LENGTH}`}
      >
        <Textarea rows={7} maxLength={MAX_DESCRIPTION_LENGTH} {...register('description')} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-bold text-foreground">Servizi</legend>
        <Controller
          name="amenities"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map(({ key, label }) => (
                <label key={key} className={choiceClass}>
                  <input
                    type="checkbox"
                    value={key}
                    checked={field.value.includes(key)}
                    onChange={() => field.onChange(field.value.includes(key) ? field.value.filter((k) => k !== key) : [...field.value, key])}
                    className="sr-only"
                  />
                  <span aria-hidden="true" className="contents">{amenityIcon(key)}</span>
                  {label}
                </label>
              ))}
            </div>
          )}
        />
        {errors.amenities && <p role="alert" className="text-sm font-bold text-danger">{errors.amenities.message ?? 'Servizio non valido'}</p>}
      </fieldset>
    </>
  );
}
