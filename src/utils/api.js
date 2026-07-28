// Imposta l'URL base a seconda dell'ambiente
const BASE_URL = import.meta.env.DEV 
  ? "http://localhost:8080" 
  : ""; // 👈 Vuoto in prod per usare i path relativi sullo stesso dominio

export const fetchAPI = async (endpoint, options = {}) => {
  const defaultOptions = {
    ...options,
    credentials: "include", // Invia automaticamente i cookie di sessione
    headers: {
      "Content-Type": "application/json",
      ...options.headers, 
    },
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, defaultOptions);
  
  if (!response.ok) {
    console.error(`Errore API su ${endpoint}:`, response.statusText);
  }

  return response;
};