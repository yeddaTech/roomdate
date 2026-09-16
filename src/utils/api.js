// Le API sono sempre sulla stessa origine del frontend: in produzione su Vercel,
// in sviluppo tramite il proxy di Vite verso il server locale (npm run dev:api).
export const fetchAPI = async (endpoint, options = {}) => {
  const defaultOptions = {
    ...options,
    credentials: "include", // Invia automaticamente i cookie di sessione
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  const response = await fetch(endpoint, defaultOptions);

  if (!response.ok) {
    console.error(`Errore API su ${endpoint}:`, response.statusText);
  }

  return response;
};
