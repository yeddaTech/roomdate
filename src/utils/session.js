import { fetchAPI } from './api';

// Logout completo: il server elimina il cookie di sessione (HttpOnly, non cancellabile da JS),
// poi puliamo tutti i dati locali, chiavi di cifratura comprese.
export const logoutSession = async () => {
  try {
    await fetchAPI('/api/login', {
      method: 'POST',
      body: JSON.stringify({ action: 'logout' })
    });
  } catch (err) {
    console.error("Errore durante il logout sul server:", err);
  }

  try {
    localStorage.removeItem('roomdate_user');
    localStorage.removeItem('roomdate_crypto');
    localStorage.removeItem('roomdate_public_key');
    sessionStorage.clear();
  } catch {
    // Storage non disponibile (es. navigazione privata): non c'è nulla da pulire
  }
};
