import React, { useState, useEffect } from 'react';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Al caricamento, controlla se c'è già una preferenza salvata
    const consent = localStorage.getItem('roomdate_cookie_consent');
    
    if (!consent) {
      // Se non c'è, mostra il banner
      setIsVisible(true);
    } else if (consent === 'all') {
      // Se aveva già accettato in passato, inietta gli script in background
      loadTrackingScripts();
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('roomdate_cookie_consent', 'all');
    setIsVisible(false);
    loadTrackingScripts(); // L'utente ha accettato: fai partire gli script!
  };

  const handleOnlyNecessary = () => {
    localStorage.setItem('roomdate_cookie_consent', 'necessary');
    setIsVisible(false);
    // Non carichiamo nulla. Restiamo invisibili ai tracciatori.
  };

  // Questa è la funzione magica che crea e inietta gli script dinamicamente
  const loadTrackingScripts = () => {
    // Controllo di sicurezza: evita di caricare lo script due volte se clicca più volte
    if (document.getElementById('analytics-script')) return;

    console.log("Consenso accordato: Iniezione script di tracciamento/ads...");
    
    const script = document.createElement('script');
    script.id = 'analytics-script';
    // QUI inserirai il link di Google Analytics, Meta Pixel o del tuo circuito pubblicitario
    script.src = 'https://tuo-futuro-script-di-analytics.js'; 
    script.async = true; // Caricamento asincrono per non bloccare la pagina
    
    document.head.appendChild(script);
  };

  // Se il banner non deve essere visibile, non renderizziamo nulla
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-orange-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 font-sans text-[#2C1A0E]">
      <div className="text-sm md:text-base leading-relaxed flex-1">
        <p>
          <strong>La tua privacy è importante.</strong> Utilizziamo cookie tecnici essenziali per far funzionare RoomDate. 
          Se ci dai il permesso, vorremmo usare anche cookie statistici e di profilazione per migliorare l'app e proporti annunci pertinenti. 
          Puoi leggere i dettagli nella nostra <a href="/privacy" className="text-[#C4603A] font-bold hover:underline">Privacy Policy</a>.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
        <button 
          onClick={handleOnlyNecessary}
          className="px-5 py-2.5 rounded-full border border-neutral-300 text-[#4A3E3D] font-bold text-sm hover:bg-neutral-50 transition-colors w-full sm:w-auto text-center"
        >
          Solo Necessari
        </button>
        <button 
          onClick={handleAcceptAll}
          className="px-5 py-2.5 rounded-full bg-[#C4603A] text-white font-bold text-sm hover:bg-[#A34E2B] transition-colors shadow-sm w-full sm:w-auto text-center"
        >
          Accetta Tutti
        </button>
      </div>
    </div>
  );
}