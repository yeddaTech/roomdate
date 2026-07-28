import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] font-sans text-neutral-900 py-12 px-6 selection:bg-orange-200">
      <Helmet>
        <title>Termini di Servizio | RoomDate</title>
        <meta name="robots" content="index, follow" />
      </Helmet>

      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-neutral-100 relative overflow-hidden">
        
        {/* Sottile orb decorativo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-400/5 blur-[80px] rounded-full pointer-events-none"></div>

        {/* Bottone Indietro */}
        <button 
          onClick={() => navigate(-1)} 
          className="mb-8 bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 text-neutral-700 px-5 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer shadow-sm"
        >
          ← Torna indietro
        </button>
        
        <h1 className="font-serif text-3xl md:text-4xl font-extrabold text-neutral-900 mb-2 tracking-tight">Termini di Servizio</h1>
        <p className="text-sm text-neutral-400 font-medium mb-8">Ultimo aggiornamento: Luglio 2026</p>

        <div className="flex flex-col gap-8 leading-relaxed text-neutral-600 font-medium">
          <section className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100">
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">1. Ruolo della Piattaforma</h2>
            <p className="text-neutral-600">
              RoomDate opera esclusivamente come fornitore di servizi della società dell'informazione (intermediario tecnico). La piattaforma mette a disposizione una bacheca digitale per facilitare l'incontro tra utenti che offrono e cercano stanze. <strong>RoomDate non è un'agenzia immobiliare</strong>, non interviene in alcun modo nelle trattative, non percepisce percentuali sugli affitti e non è parte dei contratti stipulati tra gli utenti.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">2. Esclusione di Responsabilità</h2>
            <p>
              RoomDate declina ogni responsabilità per eventuali danni, truffe, perdite economiche, controversie o illeciti derivanti dalle interazioni tra gli utenti, sia all'interno dell'applicazione (es. chat) che nella vita reale. L'utente si assume la totale e completa responsabilità di verificare l'identità dell'interlocutore, l'autenticità degli annunci e la validità legale di eventuali accordi economici o contratti di locazione.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">3. Regole di Condotta</h2>
            <p className="mb-3">
              Gli utenti si impegnano a pubblicare informazioni veritiere e a mantenere un comportamento rispettoso. È severamente vietato utilizzare RoomDate per:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2 mb-4 text-neutral-600">
              <li>Pubblicare annunci falsi, ingannevoli o discriminatori.</li>
              <li>Richiedere pagamenti anticipati fraudolenti o fuori dalle normali prassi legali di locazione.</li>
              <li>Inviare messaggi offensivi, spam o contenuti non appropriati.</li>
            </ul>
            <p>
              RoomDate si riserva il diritto insindacabile di sospendere, bannare o eliminare gli account degli utenti che violano questi Termini o che vengono segnalati per comportamenti illeciti, fornendo eventuale documentazione alle autorità competenti se richiesta dalla legge.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-100 text-center">
          <Link to="/" className="text-orange-500 font-bold hover:text-orange-600 transition-colors inline-block">Torna alla Home Page</Link>
        </div>

      </div>
    </div>
  );
}