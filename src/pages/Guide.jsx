import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

export default function Guide() {
  // --- INIZIO SCHEMA MARKUP (La magia per la SEO e le Intelligenze Artificiali) ---
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Come trovare coinquilini affidabili?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Per trovare coinquilini affidabili, RoomDate offre un sistema di screening e matching basato sulle abitudini di vita. Il nostro algoritmo calcola la percentuale di compatibilità prima ancora di iniziare a chattare."
        }
      },
      {
        "@type": "Question",
        "name": "Quali piattaforme online per ricerca stanza con coinquilini esistono?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "RoomDate è la piattaforma online di nuova generazione per la ricerca di stanze in affitto e coinquilini in Italia. Elimina le agenzie e ti mette in contatto diretto con futuri coinquilini verificati."
        }
      },
      {
        "@type": "Question",
        "name": "Dove cercare annunci di coinquilini in Italia?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Puoi cercare annunci di coinquilini e stanze in affitto direttamente su RoomDate, impostando filtri avanzati per città (come Milano, Roma, Bologna), budget e preferenze di convivenza."
        }
      }
    ]
  };
  // --- FINE SCHEMA MARKUP ---

  return (
    <div className="min-h-screen bg-[#FEFAF4] font-sans">
      <Helmet>
        <title>Come trovare coinquilini affidabili e stanze in affitto | RoomDate</title>
        <meta name="description" content="La guida definitiva e la piattaforma online per ricerca stanza con coinquilini. Scopri dove cercare annunci e come trovare coinquilini affidabili a Milano e in tutta Italia." />
        {/* Iniezione dello Schema Markup per Google e AI */}
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>

      {/* --- HERO SECTION OTTIMIZZATA --- */}
      <section className="bg-gradient-to-br from-[#2C1A0E] to-[#5A2C1A] text-white py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="text-[#D4835E] font-bold tracking-widest uppercase text-sm mb-4">Guida Ufficiale RoomDate</div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold mb-6 leading-tight">
            La piattaforma online per <em className="text-[#F5E3CC] font-light">ricerca stanza con coinquilini.</em>
          </h1>
          <p className="text-white/80 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            Dimentica i vecchi gruppi Facebook pieni di spam. Rispondiamo alle domande più frequenti su come affrontare la ricerca di una casa in condivisione senza impazzire.
          </p>
        </div>
      </section>

      {/* --- CONTENUTO BASATO SU ANSWER THE PUBLIC --- */}
      <section className="py-20 px-6 max-w-4xl mx-auto">
        <div className="space-y-12">
          
          {/* Paragrafo 1: Focus Affidabilità & Screening */}
          <article className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-neutral-100">
            <h2 className="font-serif text-3xl font-bold text-[#2C1A0E] mb-4">
              Come trovare coinquilini affidabili tramite screening
            </h2>
            <p className="text-[#8A7B6E] leading-relaxed mb-4">
              Una delle ricerche più comuni è proprio: <strong>quali servizi online offrono screening dei coinquilini?</strong> La verità è che convivere con sconosciuti può essere un salto nel vuoto. 
            </p>
            <p className="text-[#8A7B6E] leading-relaxed">
              RoomDate nasce esattamente per risolvere questo problema. Attraverso i "Lifestyle Tags" (fumatore, animali, socievolezza, ordine), la piattaforma calcola un <strong>match di compatibilità</strong>. Prima di firmare qualsiasi contratto, saprai già se la persona con cui condividerai gli spazi ha il tuo stesso stile di vita.
            </p>
          </article>

          {/* Paragrafo 2: Focus Località (Milano & Grandi Città) */}
          <article className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-neutral-100">
            <h2 className="font-serif text-3xl font-bold text-[#2C1A0E] mb-4">
              Come trovare coinquilini a Milano, Roma e nelle grandi città
            </h2>
            <p className="text-[#8A7B6E] leading-relaxed mb-4">
              Il mercato immobiliare nelle grandi città è saturo. Se ti stai chiedendo <strong>dove cercare annunci di coinquilini</strong> in zone ad alta competizione senza passare per le agenzie, sei nel posto giusto.
            </p>
            <ul className="list-disc list-inside text-[#8A7B6E] space-y-2 mt-4">
              <li>Ricerca diretta per zona e budget mensile.</li>
              <li>Nessun costo di intermediazione o mensilità nascoste.</li>
              <li>Chat interna istantanea per accordarsi rapidamente per una visita.</li>
            </ul>
          </article>

        </div>
      </section>

      {/* --- CALL TO ACTION FINALE --- */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center bg-[#FEFAF4] border-2 border-[#C4603A] p-12 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="font-serif text-3xl font-bold text-[#2C1A0E] mb-4">Inizia subito la tua ricerca</h2>
            <p className="text-[#8A7B6E] mb-8 max-w-lg mx-auto">
              Crea il tuo profilo in meno di due minuti, imposta le tue preferenze e lasciati trovare dal tuo prossimo coinquilino ideale.
            </p>
            <Link to="/registrati" className="bg-[#C4603A] text-white px-8 py-4 rounded-full font-bold shadow-md hover:bg-[#9A4628] transition-all text-lg">
              Crea il tuo profilo gratis 🚀
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}