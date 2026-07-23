import React from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#FEFAF4] font-sans text-[#4A3E3D] p-6 md:p-12">
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-orange-50">
        
        <Link to="/" className="text-[#C4603A] font-bold hover:underline mb-6 inline-block">
          &larr; Torna alla Home
        </Link>
        
        <h1 className="font-serif text-4xl text-[#2C1A0E] font-bold mb-2">Termini di Servizio</h1>
        <p className="text-[#8A7B6E] mb-8">Ultimo aggiornamento: Luglio 2026</p>

        <div className="space-y-6 leading-relaxed">
          <section>
            <h2 className="font-serif text-xl font-bold text-[#2C1A0E] mb-2">1. Ruolo della Piattaforma</h2>
            <p>
              RoomDate opera esclusivamente come fornitore di servizi della società dell'informazione (intermediario tecnico). La piattaforma mette a disposizione una bacheca digitale per facilitare l'incontro tra utenti che offrono e cercano stanze. <strong>RoomDate non è un'agenzia immobiliare</strong>, non interviene in alcun modo nelle trattative, non percepisce percentuali sugli affitti e non è parte dei contratti stipulati tra gli utenti.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold text-[#2C1A0E] mb-2">2. Esclusione di Responsabilità</h2>
            <p>
              RoomDate declina ogni responsabilità per eventuali danni, truffe, perdite economiche, controversie o illeciti derivanti dalle interazioni tra gli utenti, sia all'interno dell'applicazione (es. chat) che nella vita reale. L'utente si assume la totale e completa responsabilità di verificare l'identità dell'interlocutore, l'autenticità degli annunci e la validità legale di eventuali accordi economici o contratti di locazione.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold text-[#2C1A0E] mb-2">3. Regole di Condotta</h2>
            <p>
              Gli utenti si impegnano a pubblicare informazioni veritiere e a mantenere un comportamento rispettoso. È severamente vietato utilizzare RoomDate per:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Pubblicare annunci falsi, ingannevoli o discriminatori.</li>
              <li>Richiedere pagamenti anticipati fraudolenti o fuori dalle normali prassi legali di locazione.</li>
              <li>Inviare messaggi offensivi, spam o contenuti non appropriati.</li>
            </ul>
            <p className="mt-2">
              RoomDate si riserva il diritto insindacabile di sospendere, bannare o eliminare gli account degli utenti che violano questi Termini o che vengono segnalati per comportamenti illeciti, fornendo eventuale documentazione alle autorità competenti se richiesta dalla legge.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}