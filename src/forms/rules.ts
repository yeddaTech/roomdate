// Regole dei campi dei moduli, le stesse che applica il server (internal/users/service.go e
// internal/validate): il browser le controlla mentre si scrive, il server le ricontrolla comunque.
import { OCCUPATIONS, isCity } from '../api/options';
import { latestAdultBirthdate } from '../api/users';
import { z } from './zod';

export const MAX_NAME_LENGTH = 50;
export const MAX_BIO_LENGTH = 1000;
export const MAX_BUDGET = 20000;

/** Nome o cognome: obbligatorio, al massimo 50 caratteri. */
export function personName(what: 'Il nome' | 'Il cognome') {
  return z.string().check(
    z.trim(),
    z.minLength(1, `${what} è obbligatorio`),
    z.maxLength(MAX_NAME_LENGTH, `${what} può avere al massimo ${MAX_NAME_LENGTH} caratteri`),
  );
}

/** Email di un account nuovo (registrazione, recupero). */
export const email = z.pipe(
  z.string().check(z.trim(), z.minLength(1, 'Inserisci la tua email'), z.maxLength(254, "L'indirizzo email è troppo lungo")),
  z.email('Inserisci un indirizzo email valido, come nome@esempio.it'),
);

/**
 * Email all'accesso: controllo minimo, perché gli account creati prima delle regole attuali
 * devono poter entrare anche con indirizzi insoliti.
 */
export const loginEmail = z.string().check(
  z.trim(),
  z.minLength(1, 'Inserisci la tua email'),
  z.refine((value) => value.includes('@'), 'Inserisci un indirizzo email valido'),
);

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Data di nascita (AAAA-MM-GG): obbligatoria, e bisogna avere almeno 18 anni. */
export const birthdate = z.string().check(
  z.minLength(1, 'Inserisci la tua data di nascita'),
  z.refine((value) => isRealDate(value) && value >= '1900-01-01', 'Data di nascita non valida'),
  // Confronto tra stringhe AAAA-MM-GG: vale come confronto tra date. Si calcola a ogni controllo
  z.refine((value) => value <= latestAdultBirthdate(), 'Per usare RoomDate devi avere almeno 18 anni'),
);

export const city = z.string().check(
  z.minLength(1, 'Scegli la tua città'),
  z.refine(isCity, "Scegli la città dall'elenco"),
);

/** Città nel profilo: si può lasciare vuota (chi la indica trova chi cerca nella stessa città). */
export const optionalCity = z.string().check(
  z.refine((value) => value === '' || isCity(value), "Scegli la città dall'elenco"),
);

/** Budget mensile in euro, come testo del campo: vuoto vuol dire "non indicato". */
export const budget = z.string().check(
  z.trim(),
  z.refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) <= MAX_BUDGET),
    'Il budget deve essere un numero intero tra 0 e 20.000 €'),
);

/** Il budget del campo come numero per le API (0 se non indicato). */
export function budgetValue(value: string): number {
  return Number(value.trim()) || 0;
}

export const occupation = z.string().check(
  z.refine((value) => value === '' || OCCUPATIONS.some((o) => o.key === value), 'Occupazione non valida'),
);

export const bio = z.string().check(
  z.trim(),
  z.maxLength(MAX_BIO_LENGTH, `La presentazione può avere al massimo ${MAX_BIO_LENGTH} caratteri`),
);
