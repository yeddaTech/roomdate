/**
 * Stato di navigazione tra le pagine di accesso: la pagina protetta da cui si arriva, che si
 * riapre dopo l'accesso o la registrazione, e l'email già scritta, per non doverla ripetere.
 */
export interface AuthLocationState {
  from?: string;
  email?: string;
}
