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

/**
 * Come ricavare le chiavi dalla password. version 1: la password va al server (account vecchi);
 * version 2: il browser ricava una chiave d'accesso e una chiave che non esce mai (modulo M3.4).
 */
export interface KdfParams {
  version: 1 | 2;
  salt: string;
  iterations: number;
}

/** Dispositivo con l'accesso aperto. */
export interface UserSession {
  id: string;
  /** Descrizione del browser, per riconoscere il dispositivo. */
  device: string;
  createdAt: string;
  lastUsedAt: string;
  /** true per la sessione da cui si sta guardando. */
  current: boolean;
}

/** Profilo completo dell'utente in sessione. */
export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: UserType;
  /** Una delle città di src/api/options.ts, oppure stringa vuota se non indicata. */
  city: string;
  birthdate: string;
  budgetMax: number;
  /** Chiave di OCCUPATIONS, oppure stringa vuota se non indicata. */
  occupation: string;
  bio: string;
  /** Chiavi di LIFESTYLE_TAGS, nell'ordine dell'elenco. */
  lifestyleTags: string[];
  isPublic: boolean;
  /** true se l'utente ha una chiave di recupero per la password dimenticata. */
  hasRecoveryKey: boolean;
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
  lifestyleTags: string[];
  keys: CryptoKeys;
  kdf: KdfParams;
  recovery: RecoveryInput;
}

/** Chiave di recupero preparata dal browser: al server non arriva mai il codice. */
export interface RecoveryInput {
  salt: string;
  /** Chiave ricavata dal codice, con cui si dimostra di averlo. */
  authKey: string;
  /** Copia della chiave privata cifrata con il codice; vuota se l'account non ha chiavi. */
  encryptedPrivateKey: string;
  iv: string;
}

/**
 * Cosa hanno in comune chi guarda e un altro profilo, calcolato dal server sui dati indicati da entrambi.
 * Non è un punteggio: ogni voce ha un motivo preciso.
 */
export interface Compatibility {
  sameCity: boolean;
  /** Entrambi hanno un budget e differiscono al massimo di 100 €. */
  similarBudget: boolean;
  sharedTags: string[];
  /** Uno ha indicato "Fumatore" e l'altro "Non fumatore". */
  smokingMismatch: boolean;
}

/** Profilo visibile agli altri utenti: niente cognome, email o data di nascita. */
export interface PublicProfile {
  id: string;
  firstName: string;
  /** Anni compiuti, o null se la data di nascita non è indicata. */
  age: number | null;
  userType: UserType;
  city: string;
  budgetMax: number;
  occupation: string;
  bio: string;
  lifestyleTags: string[];
  /** null senza sessione o sul proprio profilo. */
  compatibility: Compatibility | null;
}

/** Profilo nell'elenco dei coinquilini (solo chi cerca una stanza, con profilo pubblico). */
export type Roommate = Omit<PublicProfile, 'userType'>;

export interface RoommatesPage {
  items: Roommate[];
  /** Da passare alla richiesta successiva; null se non ci sono altri profili. */
  nextCursor: string | null;
}

export type RoomType = 'singola' | 'doppia';

/** Annuncio negli elenchi (pubblici e "I miei annunci"). */
export interface ListingSummary {
  id: number;
  title: string;
  city: string;
  zone: string;
  roomType: RoomType;
  price: number;
  /** null per gli annunci pubblicati prima che il dato esistesse. */
  billsIncluded: boolean | null;
  /** Data AAAA-MM-GG da cui la stanza è libera, o null se non indicata. */
  availableFrom: string | null;
  isActive: boolean;
  /** Prima foto dell'annuncio, o null se non ne ha. */
  coverUrl: string | null;
}

/** Ordinamenti dell'elenco degli annunci, come li accetta il server. */
export type ListingSort = 'recenti' | 'prezzo' | 'prezzo-desc';

/** Filtri dell'elenco degli annunci; i campi vuoti non filtrano nulla. */
export interface ListingFilters {
  city?: string;
  maxPrice?: string;
  roomType?: RoomType | '';
  billsIncluded?: 'true' | 'false' | '';
  sort?: ListingSort;
}

export interface ListingsPage {
  items: ListingSummary[];
  /** Da passare alla richiesta successiva; null se non ci sono altri annunci. */
  nextCursor: string | null;
}

export interface ListingImage {
  id: number;
  url: string;
}

export interface ListingDetail extends ListingSummary {
  description: string;
  amenities: string[];
  images: ListingImage[];
  owner: { firstName: string };
  /** true se chi guarda è il proprietario. */
  isOwner: boolean;
}

export interface ListingInput {
  title: string;
  city: string;
  zone: string;
  roomType: RoomType;
  price: number;
  description: string;
  amenities: string[];
  billsIncluded: boolean;
  /** AAAA-MM-GG, oppure stringa vuota se non indicata. */
  availableFrom: string;
}

/** Caricamento di una foto autorizzato dal server: il browser invia il file direttamente allo storage. */
export interface PendingUpload {
  key: string;
  url: string;
  headers: Record<string, string>;
  maxBytes: number;
}

/** Messaggio come arriva dal server: il testo resta cifrato finché il browser non lo apre. */
export interface ChatMessage {
  id: number;
  senderId: string;
  /** 1 = una copia cifrata per destinatario (messaggi vecchi), 2 = cifratura ibrida. */
  format: 1 | 2;
  body: string;
  /** Vuoti nel formato 1. */
  iv: string;
  key: string;
  /** Istante in UTC (ISO 8601); il browser lo mostra nell'ora locale. */
  createdAt: string;
}

export interface Conversation {
  id: number;
  /** Annuncio da cui è nata la chat; null per le chat dirette o se l'annuncio è stato eliminato. */
  listing: { id: number; title: string; price: number } | null;
  /** null se l'altro partecipante ha eliminato l'account. */
  other: { id: string; firstName: string; publicKey: string } | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ConversationsPage {
  items: Conversation[];
  nextCursor: string | null;
}

export interface MessagesPage {
  /** Dal più recente al più vecchio. */
  items: ChatMessage[];
  nextCursor: string | null;
}
