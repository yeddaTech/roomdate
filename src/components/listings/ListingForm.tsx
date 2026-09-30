import { useState, type ChangeEvent, type FormEvent } from 'react';
import { AMENITIES, CITIES, isCity } from '../../api/options';
import { ApiError } from '../../api/client';
import type { ListingDetail, ListingInput, RoomType } from '../../api/types';

const inputClass = 'w-full bg-background border border-line px-5 py-4 rounded-2xl text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden transition-all';

// Valori del modulo come stringhe, così i campi restano controllati anche quando sono vuoti
interface FormState {
  title: string;
  city: string;
  zone: string;
  roomType: RoomType;
  price: string;
  description: string;
  amenities: string[];
  billsIncluded: '' | 'true' | 'false';
  availableFrom: string;
}

function emptyForm(): FormState {
  return { title: '', city: '', zone: '', roomType: 'singola', price: '', description: '', amenities: [], billsIncluded: '', availableFrom: '' };
}

function formFromListing(listing: ListingDetail): FormState {
  return {
    title: listing.title,
    // Una città salvata prima degli elenchi condivisi, e non riconosciuta, va scelta di nuovo
    city: isCity(listing.city) ? listing.city : '',
    zone: listing.zone,
    roomType: listing.roomType,
    price: String(listing.price),
    description: listing.description,
    amenities: listing.amenities,
    // Gli annunci vecchi non hanno il dato: va scelto prima di salvare
    billsIncluded: listing.billsIncluded === null ? '' : listing.billsIncluded ? 'true' : 'false',
    availableFrom: listing.availableFrom ?? '',
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? <div className="text-danger text-xs mt-1 ml-1 font-bold">{message}</div> : null;
}

/**
 * Modulo di creazione e modifica di un annuncio.
 * onSubmit riceve i dati per l'API; se rifiuta con un ApiError, gli errori dei campi compaiono sotto ciascun campo.
 */
interface Props {
  /** Annuncio da modificare; assente per un annuncio nuovo. */
  listing?: ListingDetail;
  submitLabel: string;
  onSubmit: (input: ListingInput) => Promise<void>;
}

export default function ListingForm({ listing, submitLabel, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(() => (listing ? formFromListing(listing) : emptyForm()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (field: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const toggleAmenity = (key: string) => {
    const amenities = form.amenities.includes(key) ? form.amenities.filter((a) => a !== key) : [...form.amenities, key];
    setForm({ ...form, amenities });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError('');

    if (form.billsIncluded === '') {
      setErrors({ billsIncluded: 'Indica se le spese sono incluse nel prezzo' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: form.title,
        city: form.city,
        zone: form.zone,
        roomType: form.roomType,
        price: parseInt(form.price, 10) || 0,
        description: form.description,
        amenities: form.amenities,
        billsIncluded: form.billsIncluded === 'true',
        availableFrom: form.availableFrom,
      });
    } catch (err) {
      if (err instanceof ApiError && err.fields.length > 0) {
        setErrors(Object.fromEntries(err.fields.map((f) => [f.field, f.message])));
      } else {
        setGeneralError(err instanceof Error ? err.message : 'Si è verificato un errore. Riprova.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {generalError && (
        <div className="p-4 rounded-2xl font-bold bg-danger-soft text-danger border border-danger/30">⚠️ {generalError}</div>
      )}

      <div>
        <input name="title" type="text" placeholder="Titolo (Es: Camera Singola Navigli)" value={form.title} onChange={set('title')} maxLength={100} className={inputClass} />
        <FieldError message={errors.title} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <select name="city" value={form.city} onChange={set('city')} className={inputClass}>
            <option value="">Città</option>
            {CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <FieldError message={errors.city} />
        </div>
        <div>
          <input name="zone" type="text" placeholder="Zona o quartiere (facoltativo)" value={form.zone} onChange={set('zone')} maxLength={80} className={inputClass} />
          <FieldError message={errors.zone} />
        </div>
        <div>
          <select name="roomType" value={form.roomType} onChange={set('roomType')} className={inputClass}>
            <option value="singola">Singola</option>
            <option value="doppia">Doppia</option>
          </select>
          <FieldError message={errors.roomType} />
        </div>
        <div>
          <input name="price" type="number" min="1" max="20000" placeholder="Prezzo al mese (€)" value={form.price} onChange={set('price')} className={inputClass} />
          <FieldError message={errors.price} />
        </div>
        <div>
          <select name="billsIncluded" value={form.billsIncluded} onChange={set('billsIncluded')} className={inputClass}>
            <option value="">Spese incluse nel prezzo?</option>
            <option value="true">Sì, spese incluse</option>
            <option value="false">No, spese escluse</option>
          </select>
          <FieldError message={errors.billsIncluded} />
        </div>
        <div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-foreground-subtle ml-1">Disponibile dal (facoltativo)</span>
            <input name="availableFrom" type="date" value={form.availableFrom} onChange={set('availableFrom')} className={inputClass} />
          </label>
          <FieldError message={errors.availableFrom} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-bold text-foreground">Servizi</span>
        <div className="flex flex-wrap gap-3">
          {AMENITIES.map(({ key, label }) => (
            <label key={key} className="relative cursor-pointer group">
              <input type="checkbox" name="amenities" value={key} checked={form.amenities.includes(key)} onChange={() => toggleAmenity(key)} className="peer sr-only" />
              <span className="block px-5 py-2.5 bg-surface border border-line rounded-full text-sm font-semibold text-foreground-subtle peer-checked:bg-foreground peer-checked:text-background peer-checked:border-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-focus transition-all shadow-xs group-hover:border-control">
                {label}
              </span>
            </label>
          ))}
        </div>
        <FieldError message={errors.amenities} />
      </div>

      <div>
        <textarea name="description" placeholder="Descrizione dettagliata..." rows={5} value={form.description} onChange={set('description')} maxLength={5000} className={`${inputClass} rounded-3xl resize-none`}></textarea>
        <FieldError message={errors.description} />
      </div>

      <div className="mt-4 pt-8 border-t border-line flex justify-end">
        <button type="submit" disabled={isSubmitting} className={`w-full md:w-auto px-10 py-4 rounded-full font-bold transition-all shadow-md ${isSubmitting ? 'bg-control text-foreground-subtle cursor-not-allowed shadow-none' : 'bg-foreground text-background hover:bg-foreground/85 cursor-pointer'}`}>
          {isSubmitting ? 'Salvataggio in corso...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
