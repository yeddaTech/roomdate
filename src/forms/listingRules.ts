// Regole del modulo di un annuncio, le stesse del server (parseInput in internal/listings/service.go):
// il browser le controlla mentre si scrive, il server le ricontrolla comunque.
import { AMENITIES, isCity } from '../api/options';
import type { ListingDetail, ListingInput, RoomType } from '../api/types';
import { z } from './zod';

export const MAX_TITLE_LENGTH = 100;
export const MAX_ZONE_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_PRICE = 20000;

/** Primo giorno ammesso per "disponibile dal" e ultimo (come il server: da un anno fa a fra due). */
export function availabilityRange(now = new Date()): { min: string; max: string } {
  const day = (years: number) => {
    const d = new Date(Date.UTC(now.getUTCFullYear() + years, now.getUTCMonth(), now.getUTCDate()));
    return d.toISOString().slice(0, 10);
  };
  return { min: day(-1), max: day(2) };
}

const title = z.string().check(
  z.trim(),
  z.minLength(1, 'Dai un titolo all’annuncio'),
  z.maxLength(MAX_TITLE_LENGTH, `Il titolo può avere al massimo ${MAX_TITLE_LENGTH} caratteri`),
);

const city = z.string().check(
  z.minLength(1, 'Scegli la città'),
  z.refine(isCity, "Scegli la città dall'elenco"),
);

const zone = z.string().check(
  z.trim(),
  z.maxLength(MAX_ZONE_LENGTH, `La zona può avere al massimo ${MAX_ZONE_LENGTH} caratteri`),
);

const roomType = z.enum(['singola', 'doppia'], 'Scegli il tipo di stanza');

/** Prezzo come testo del campo: un numero intero tra 1 e 20.000. */
const price = z.string().check(
  z.trim(),
  z.minLength(1, 'Indica il prezzo al mese'),
  z.refine((value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= MAX_PRICE,
    'Il prezzo deve essere un numero intero tra 1 e 20.000 €'),
);

const billsIncluded = z.string().check(
  z.refine((value) => value === 'true' || value === 'false', 'Indica se le spese sono incluse nel prezzo'),
);

const availableFrom = z.string().check(
  z.refine((value) => {
    if (value === '') return true;
    const { min, max } = availabilityRange();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= min && value <= max;
  }, 'La data deve essere entro i prossimi due anni'),
);

const description = z.string().check(
  z.trim(),
  z.minLength(1, 'Descrivi la stanza: chi cerca casa vuole sapere com’è'),
  z.maxLength(MAX_DESCRIPTION_LENGTH, `La descrizione può avere al massimo ${MAX_DESCRIPTION_LENGTH} caratteri`),
);

const amenities = z.array(z.string().check(z.refine((key) => AMENITIES.some((a) => a.key === key), 'Servizio non valido')));

/** Tutti i campi dell'annuncio: la creazione guidata li controlla un passo alla volta. */
export const listingSchema = z.object({ title, city, zone, roomType, price, billsIncluded, availableFrom, description, amenities });

export type ListingValues = z.infer<typeof listingSchema>;

/** Campi del primo passo, per controllarli prima di andare avanti e riportarci gli errori del server. */
export const BASICS_FIELDS = ['title', 'city', 'zone', 'roomType', 'price', 'billsIncluded', 'availableFrom'] as const;

export function emptyListingValues(): ListingValues {
  return { title: '', city: '', zone: '', roomType: 'singola', price: '', billsIncluded: '', availableFrom: '', description: '', amenities: [] };
}

/** Valori del modulo da un annuncio salvato. */
export function listingValues(listing: ListingDetail): ListingValues {
  return {
    title: listing.title,
    // Una città salvata prima degli elenchi condivisi, e non riconosciuta, va scelta di nuovo
    city: isCity(listing.city) ? listing.city : '',
    zone: listing.zone,
    roomType: listing.roomType as RoomType,
    price: String(listing.price),
    // Gli annunci vecchi non hanno il dato: va scelto prima di salvare
    billsIncluded: listing.billsIncluded === null ? '' : String(listing.billsIncluded),
    availableFrom: listing.availableFrom ?? '',
    description: listing.description,
    amenities: listing.amenities,
  };
}

/** Dati per le API dai valori del modulo. */
export function listingInput(values: ListingValues): ListingInput {
  return {
    title: values.title.trim(),
    city: values.city,
    zone: values.zone.trim(),
    roomType: values.roomType,
    price: Number(values.price),
    description: values.description.trim(),
    amenities: values.amenities,
    billsIncluded: values.billsIncluded === 'true',
    availableFrom: values.availableFrom,
  };
}
