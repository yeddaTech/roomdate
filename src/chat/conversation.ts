import type { Conversation } from '../api/types';

/** Nome dell'altro partecipante: chi ha eliminato l'account non ha più un nome da mostrare. */
export const nameOf = (conversation: Conversation) => conversation.other?.firstName || 'Utente eliminato';

/** Domande pronte per chi scrive a proposito di una stanza, finché non ha ancora scritto nulla. */
export const LISTING_QUESTIONS = [
  'La stanza è ancora disponibile?',
  'Posso venire a vederla?',
  'Le spese sono incluse nel prezzo?',
  'Che tipo di contratto è?',
  'Com’è la zona con i mezzi?',
];
