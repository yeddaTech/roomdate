import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] font-sans text-neutral-900 py-12 px-6 selection:bg-orange-200">
      <Helmet>
        <title>Informativa sulla Privacy e Sicurezza | RoomDate</title>
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

        <h1 className="font-serif text-3xl md:text-4xl font-extrabold text-neutral-900 mb-2 tracking-tight">
          Informativa sulla Privacy e Sicurezza
        </h1>
        <p className="text-sm text-neutral-400 font-medium mb-8">Ultimo aggiornamento: Luglio 2026</p>

        <div className="flex flex-col gap-8 leading-relaxed text-neutral-600 font-medium">
          
          <section className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100">
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">1. Titolare del Trattamento</h2>
            <p className="text-neutral-600">
              La piattaforma <strong>RoomDate</strong> è un'applicazione in fase di sviluppo (MVP). Il Titolare del Trattamento dei dati personali è la Direzione di RoomDate. Per qualsiasi richiesta relativa alla privacy o per esercitare i propri diritti, è possibile contattare il Titolare all'indirizzo email: <a href="mailto:esyoun70@gmail.com" className="text-orange-500 font-bold hover:text-orange-600 transition-colors">esyoun70@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">2. Dati Raccolti e Luogo del Trattamento</h2>
            <p className="mb-3">Raccogliamo solo i dati strettamente necessari all'utilizzo della piattaforma:</p>
            <ul className="list-disc pl-5 flex flex-col gap-2 mb-4 text-neutral-600">
              <li>Dati di registrazione (Nome, email, password cifrata).</li>
              <li>Dati del profilo pubblico (Età, preferenze di convivenza, foto).</li>
              <li>Informazioni sugli annunci inseriti (Città, zona, prezzo, immagini della stanza).</li>
              <li>Log delle chat scambiate all'interno della piattaforma per consentire la messaggistica in tempo reale.</li>
            </ul>
            <p>
              I dati raccolti vengono elaborati tramite infrastruttura cloud (Vercel) e conservati in modo sicuro su database dedicati (infrastruttura Neon), situati fisicamente all'interno dell'Unione Europea, nel pieno rispetto delle normative GDPR.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">3. Cookie e Strumenti di Tracciamento</h2>
            <p className="mb-3">
              RoomDate utilizza cookie tecnici e strumenti di memorizzazione locale (come il <code>localStorage</code> del browser) necessari per il corretto funzionamento della piattaforma e per gestire in sicurezza le sessioni utente. 
            </p>
            <p>
              Inoltre, previo consenso, la piattaforma si riserva il diritto di utilizzare cookie analitici e di profilazione di terze parti. Questi strumenti ci permettono di analizzare il traffico, comprendere l'utilizzo dell'app e fornire annunci pubblicitari o contenuti in linea con le preferenze dell'utente. È possibile gestire o revocare il proprio consenso in qualsiasi momento tramite l'apposito pannello di gestione dei cookie.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">4. Visibilità dei Dati e Bot AI</h2>
            <p>
              Gli annunci immobiliari e i profili contrassegnati come "pubblici" sono accessibili liberamente sulla rete. Tali dati possono essere indicizzati dai motori di ricerca tradizionali e scansionati da bot di Intelligenza Artificiale (AIO) al solo scopo di favorire il matching e la visibilità degli annunci stessi. L'utente può richiedere la rimozione o la modifica dei propri dati in qualsiasi momento.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">5. Sicurezza e Limitazione di Responsabilità</h2>
            <p className="mb-3">
              RoomDate adotta misure di sicurezza tecniche (come la cifratura delle password e connessioni sicure) per proteggere i tuoi dati. Tuttavia, RoomDate funge esclusivamente da <strong>intermediario tecnologico</strong>. 
            </p>
            <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-100 text-rose-800 text-sm leading-relaxed">
              ⚠️ <strong>Nota di sicurezza per gli utenti:</strong> Non inviare mai denaro, caparre o documenti d'identità sensibili all'interno della chat privata prima di aver visionato di persona l'immobile e aver sottoscritto un regolare contratto di locazione. RoomDate non si assume alcuna responsabilità per transazioni o accordi economici presi privatamente tra gli utenti.
            </div>
          </section>

          <section>
            <h2 className="font-serif text-xl font-extrabold text-neutral-900 mb-3">6. Diritti dell'Utente</h2>
            <p>
              In conformità con il GDPR, hai il diritto di accedere ai tuoi dati, chiederne la rettifica, la portabilità o la cancellazione definitiva ("diritto all'oblio") inviando una richiesta all'indirizzo email del Titolare o eliminando direttamente il tuo account dalle impostazioni del profilo.
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