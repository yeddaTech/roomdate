import type { Profile } from '../api/types';

/** Una cosa che rende il profilo più utile a chi lo guarda, con il campo del modulo da compilare. */
export interface CompletenessItem {
  field: 'city' | 'budgetMax' | 'occupation' | 'bio' | 'lifestyleTags';
  label: string;
  done: boolean;
}

/** Sotto questa lunghezza la presentazione dice poco. */
export const MIN_BIO_LENGTH = 40;
/** Abitudini che bastano a confrontarsi con gli altri. */
export const MIN_LIFESTYLE_TAGS = 3;

/**
 * Quanto è completo il profilo salvato, cioè quello che vedono gli altri. Conta solo ciò che
 * serve davvero: la città e il budget per la compatibilità, il resto per farsi conoscere.
 */
export function profileCompleteness(profile: Profile): { items: CompletenessItem[]; percent: number } {
  const seeker = profile.userType === 'cerca';
  const items: CompletenessItem[] = [
    { field: 'city', label: seeker ? 'La città in cui cerchi' : 'La tua città', done: profile.city !== '' },
    ...(seeker ? [{ field: 'budgetMax' as const, label: 'Il budget massimo', done: profile.budgetMax > 0 }] : []),
    { field: 'occupation', label: 'L’occupazione', done: profile.occupation !== '' },
    { field: 'bio', label: 'Una presentazione di qualche riga', done: profile.bio.trim().length >= MIN_BIO_LENGTH },
    { field: 'lifestyleTags', label: `Almeno ${MIN_LIFESTYLE_TAGS} abitudini`, done: profile.lifestyleTags.length >= MIN_LIFESTYLE_TAGS },
  ];
  const done = items.filter((item) => item.done).length;
  return { items, percent: Math.round((done / items.length) * 100) };
}
