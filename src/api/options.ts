// Elenchi di valori ammessi (città, occupazioni, abitudini, servizi), condivisi con il server:
// l'unica fonte è shared/options.json, che il backend Go include nel binario.
import options from '../../shared/options.json';

export interface Option {
  key: string;
  label: string;
}

export interface LifestyleTag extends Option {
  emoji: string;
}

/** Città ammesse per profili e annunci, in ordine alfabetico. Si salvano con il nome. */
export const CITIES: readonly string[] = options.cities;
export const OCCUPATIONS: readonly Option[] = options.occupations;
export const LIFESTYLE_TAGS: readonly LifestyleTag[] = options.lifestyleTags;
/** Servizi che un annuncio può indicare, nell'ordine in cui vengono mostrati. */
export const AMENITIES: readonly Option[] = options.amenities;

const SMOKING_TAGS = ['fumatore', 'non_fumatore'];

export function isCity(value: string): boolean {
  return CITIES.includes(value);
}

/** Etichetta dell'occupazione, o null se non indicata. */
export function occupationLabel(key: string): string | null {
  return OCCUPATIONS.find((o) => o.key === key)?.label ?? null;
}

export function amenityLabel(key: string): string {
  return AMENITIES.find((a) => a.key === key)?.label ?? key;
}

/** Abitudine con emoji ed etichetta; undefined per una chiave sconosciuta. */
export function lifestyleTag(key: string): LifestyleTag | undefined {
  return LIFESTYLE_TAGS.find((t) => t.key === key);
}

/**
 * Aggiunge o toglie un'abitudine, nell'ordine dell'elenco.
 * "Fumatore" e "Non fumatore" si escludono: sceglierne uno toglie l'altro.
 */
export function toggleLifestyleTag(tags: readonly string[], key: string): string[] {
  const selected = new Set(tags);
  if (selected.has(key)) {
    selected.delete(key);
  } else {
    if (SMOKING_TAGS.includes(key)) SMOKING_TAGS.forEach((t) => selected.delete(t));
    selected.add(key);
  }
  return LIFESTYLE_TAGS.map((t) => t.key).filter((k) => selected.has(k));
}
