
// Imposta l'URL base a seconda che tu sia in locale o in produzione
const BASE_URL = import.meta.env.DEV 
  ? "http://localhost:8080" 
  : "https://roomdate.vercel.app";

export const fetchAPI = async (endpoint, options = {}) => {
  // Prepariamo le impostazioni di default per OGNI chiamata
  const defaultOptions = {
    ...options,
    credentials: "include", // 👈 INIETTATO AUTOMATICAMENTE SEMPRE
    headers: {
      "Content-Type": "application/json",
      ...options.headers, // Mantiene eventuali altri header che passi
    },
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, defaultOptions);
  
  // Opzionale: puoi anche gestire gli errori globalmente qui
  if (!response.ok) {
    console.error(`Errore API su ${endpoint}:`, response.statusText);
  }

  return response;
};