// Tipi dei dati scambiati con le API, con nomi coerenti in tutto il frontend.
// Le risposte delle API legacy vengono convertite in questi tipi in src/api/*.ts.

export type UserType = 'cerca' | 'affitta';

/** Utente in sessione. */
export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: UserType;
}

/** Chiave pubblica e chiave privata E2EE cifrata con la password dell'utente. */
export interface CryptoKeys {
  publicKey: string;
  encryptedPrivateKey: string;
  cryptoSalt: string;
  cryptoIv: string;
}

/** Chiave privata cifrata di nuovo con una nuova password (senza chiave pubblica). */
export type WrappedPrivateKey = Omit<CryptoKeys, 'publicKey'>;

/** Profilo completo dell'utente in sessione. */
export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: UserType;
  city: string;
  birthdate: string;
  budgetMax: number;
  occupation: string;
  bio: string;
  lifestyleTags: string;
  isPublic: boolean;
}

export type ProfileInput = Pick<Profile, 'userType' | 'city' | 'budgetMax' | 'occupation' | 'birthdate' | 'bio' | 'lifestyleTags' | 'isPublic'>;

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  city: string;
  userType: UserType;
  birthdate: string;
  budgetMax: number;
  occupation: string;
  bio: string;
  lifestyleTags: string;
  keys: CryptoKeys;
}

/** Profilo visibile agli altri utenti. */
export interface PublicProfile {
  id: string;
  firstName: string;
  userType: UserType;
  city: string;
  budgetMax: number;
  occupation: string;
  bio: string;
  lifestyleTags: string;
}

/** Profilo nell'elenco dei coinquilini. */
export interface Roommate {
  id: string;
  name: string;
  occupation: string;
  bio: string;
  age: number;
  city: string;
  match: number;
  color1: string;
  color2: string;
  emoji: string;
  tags: string[];
  userType: UserType;
  budgetMax: number;
}

/** Annuncio negli elenchi. */
export interface ListingSummary {
  id: number;
  title: string;
  city: string;
  zone: string;
  price: number;
  color: string;
  emoji: string;
  available: boolean;
  tags: string[];
}

export interface ListingDetail {
  id: number;
  title: string;
  city: string;
  zone: string;
  price: number;
  roomType: string;
  description: string;
  features: string[];
  images: string[];
  landlord: { name: string; role: string; emoji: string };
}

/** Annuncio nell'elenco "I miei annunci". */
export interface MyListing {
  id: number;
  title: string;
  city: string;
  price: number;
  roomType: string;
}

export interface ListingInput {
  title: string;
  city: string;
  zone: string;
  roomType: string;
  price: number;
  description: string;
}

export interface ChatMessage {
  id: number | string;
  type: 'sent' | 'received';
  /** Cifrato come arriva dal server; il browser lo decifra prima di mostrarlo. */
  text: string;
  time: string;
  isTemp?: boolean;
}

export interface Conversation {
  id: number;
  name: string;
  emoji: string;
  color1: string;
  color2: string;
  listing: { emoji: string; title: string; price: number };
  targetPublicKey: string;
  messages: ChatMessage[];
}
