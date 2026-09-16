// Client HTTP unico per le API di Roomdate. Le API sono sempre sulla stessa origine del frontend:
// in produzione su Vercel, in sviluppo tramite il proxy di Vite verso il server locale.

export interface FieldError {
  field: string;
  message: string;
}

/** Errore restituito da una chiamata API, con un messaggio già adatto all'utente. */
export class ApiError extends Error {
  readonly status: number;
  /** Codice stabile delle API v1 (es. "invalid_credentials"); assente per le API legacy. */
  readonly code: string | undefined;
  readonly fields: FieldError[];

  constructor(status: number, code: string | undefined, message: string, fields: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/**
 * Indica se l'errore significa "sessione assente o scaduta".
 * Un 401 per password errata (codice invalid_credentials) non lo è: l'utente resta connesso.
 */
export function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code !== 'invalid_credentials';
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
}

/** Esegue una richiesta e restituisce il corpo JSON (undefined per le risposte vuote). */
export async function request<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', 'Errore di connessione al server.');
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  if (response.headers.get('Content-Type')?.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

interface ErrorBody {
  error?: { code?: string; message?: string; fields?: FieldError[] };
}

async function toApiError(response: Response): Promise<ApiError> {
  const contentType = response.headers.get('Content-Type') ?? '';
  const text = await response.text().catch(() => '');

  // API v1: {"error": {"code", "message", "fields"}}
  if (contentType.includes('application/json')) {
    try {
      const { error } = JSON.parse(text) as ErrorBody;
      if (error?.message) return new ApiError(response.status, error.code, error.message, error.fields ?? []);
    } catch {
      // corpo non valido: si usa il messaggio generico
    }
  }

  // API legacy: messaggio in testo semplice. Altri formati (es. pagine HTML di un proxy) non si mostrano.
  const message = contentType.includes('text/plain') && text.trim() ? text.trim() : genericMessage(response.status);
  return new ApiError(response.status, undefined, message);
}

function genericMessage(status: number): string {
  if (status === 401) return 'Sessione scaduta: accedi di nuovo.';
  if (status === 403) return 'Non hai i permessi per questa operazione.';
  if (status === 404) return 'Contenuto non trovato.';
  if (status === 429) return 'Troppe richieste: riprova tra qualche minuto.';
  return 'Si è verificato un errore. Riprova più tardi.';
}
