// Dati e passi della registrazione. Ogni passo è un modulo a sé: "Avanti" lo invia e lo
// controlla, i dati si accumulano qui e al server arrivano tutti insieme alla fine.

export type Role = 'cerca' | 'affitta';

export interface RegistrationData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  userType: Role | '';
  city: string;
  birthdate: string;
  /** Testo del campo; vuoto = non indicato. */
  budgetMax: string;
  occupation: string;
  bio: string;
  lifestyleTags: string[];
  acceptTerms: boolean;
}

export const emptyRegistration: RegistrationData = {
  firstName: '', lastName: '', email: '', password: '',
  userType: '',
  city: '', birthdate: '', budgetMax: '', occupation: '', bio: '',
  lifestyleTags: [], acceptTerms: false,
};

export const STEPS = [
  { title: 'Account', fields: ['firstName', 'lastName', 'email', 'password'] },
  { title: 'Chi sei', fields: ['userType'] },
  { title: 'Profilo', fields: ['city', 'birthdate', 'budgetMax', 'occupation', 'bio'] },
  { title: 'Stile di vita', fields: ['lifestyleTags', 'acceptTerms'] },
] as const;

export const LAST_STEP = STEPS.length;

/** Errori dei campi restituiti dal server, per nome del campo. */
export type ServerErrors = Partial<Record<keyof RegistrationData, string>>;

/** Il passo in cui si trova un campo, o null se non è un campo del modulo (es. le chiavi). */
export function stepOfField(field: string): number | null {
  const index = STEPS.findIndex((step) => (step.fields as readonly string[]).includes(field));
  return index === -1 ? null : index + 1;
}

/** Gli errori che riguardano i campi di un passo. */
export function errorsOfStep(errors: ServerErrors, step: number): ServerErrors {
  const fields = STEPS[step - 1].fields as readonly string[];
  return Object.fromEntries(Object.entries(errors).filter(([field]) => fields.includes(field)));
}
