import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FEFAF4] font-sans text-[#2C1A0E] py-12 px-6">
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-orange-50">
        
        {/* Bottone Indietro */}
        <button 
          onClick={() => navigate(-1)} 
          className="mb-8 bg-neutral-100 hover:bg-neutral-200 text-[#2C1A0E] px-4 py-2 rounded-full text-sm font-bold transition-all"
        >
          ← Torna indietro
        </button>

        <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#C4603A] mb-6">
          Informativa sulla Privacy e Sicurezza
        </h1>
        <p className="text-sm text-[#8A7B6E] mb-8">Ultimo aggiornamento: Luglio 2026</p>

        <div className="flex flex-col gap-6 leading-relaxed text-[#4A3E3D]">
          
          <section>
            <h2 className="font-serif text-xl font-bold text-[#2C1A0E] mb-2">1. Titolare del Trattamento</h2>
            <p>
              La piattaforma <strong>RoomDate</strong> è un'applicazione in fase di sviluppo (MVP). Il trattamento dei dati è limitato esclusivamente all'erogazione dei servizi di ricerca coinquilini e stanze.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold text-[#2C1A0E] mb-2">2. Dati Raccolti</h2>
            <p>Raccogliamo solo i dati strettamente necessari all'utilizzo della piattaforma:</p>
            <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">
              <li>Dati di registrazione (Nome, email, password cifrata).</li>
              <li>Dati del profilo pubblico (Età, preferenze di convivenza, foto).</li>
              <li>Informazioni sugli annunci inseriti (Città, zona, prezzo, immagini della stanza).</li>
              <li>Log delle chat scambiate all'interno della piattaforma per consentire la messaggistica in tempo reale.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold text-[#2C1A0E] mb-2">3. Visibilità dei Dati e Bot AI</h2>
            <p>
              Gli annunci immobiliari e i profili contrassegnati come "pubblici" sono accessibili liberamente sulla rete. Tali dati possono essere indicizzati dai motori di ricerca tradizionali e scansionati da bot di Intelligenza Artificiale (AIO) al solo scopo di favorire il matching e la visibilità degli annunci stessi. L'utente può richiedere la rimozione o la modifica dei propri dati in qualsiasi momento.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold text-[#2C1A0E] mb-2">4. Sicurezza e Limitazione di Responsabilità</h2>
            <p>
              RoomDate adotta misure di sicurezza tecniche (come la cifratura delle password) per proteggere i tuoi dati. Tuttavia, RoomDate funge esclusivamente da <strong>intermediario tecnologico</strong>. 
            </p>
            <p className="mt-2 font-medium text-red-700 bg-red-50 p-4 rounded-xl border border-red-100">
              ⚠️ <strong>Nota di sicurezza per gli utenti:</strong> Non inviare mai denaro, caparre o documenti d'identità sensibili all'interno della chat privata prima di aver visionato di persona l'immobile e aver sottoscritto un regolare contratto di locazione. RoomDate non si assume alcuna responsabilità per transazioni o accordi economici presi privatamente tra gli utenti.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-bold text-[#2C1A0E] mb-2">5. Diritti dell'Utente</h2>
            <p>
              In conformità con il GDPR, hai il diritto di accedere ai tuoi dati, chiederne la rettifica, la portabilità o la cancellazione definitiva ("diritto all'oblio") inviando una richiesta al supporto tecnico o eliminando direttamente il tuo account dalle impostazioni del profilo.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-neutral-100 text-center">
          <Link to="/" className="text-[#C4603A] font-bold hover:underline">Torna alla Home Page</Link>
        </div>

      </div>
    </div>
  );
}