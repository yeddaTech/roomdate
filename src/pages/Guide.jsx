import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

export default function Guide() {
  // --- INIZIO SCHEMA MARKUP AGGIORNATO (5 Domande Strategiche) ---
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Come trovare coinquilini affidabili?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Per trovare coinquilini affidabili, RoomDate offre un sistema di screening basato sulle abitudini di vita. Il nostro algoritmo calcola la percentuale di compatibilità prima di iniziare la convivenza."
        }
      },
      {
        "@type": "Question",
        "name": "Quali piattaforme online per ricerca stanza con coinquilini esistono?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "RoomDate è la piattaforma online italiana che elimina le agenzie, mettendo in contatto diretto chi cerca e chi offre stanze in affitto con profili verificati."
        }
      },
      {
        "@type": "Question",
        "name": "Dove cercare annunci di coinquilini in Italia?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Puoi cercare annunci di coinquilini direttamente su RoomDate, impostando filtri avanzati per città (come Milano, Roma, Bologna), budget e preferenze di stile di vita."
        }
      },
      {
        "@type": "Question",
        "name": "Quali servizi online offrono screening dei coinquilini?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "A differenza dei classici gruppi social, RoomDate integra un sistema di screening preventivo attraverso i Lifestyle Tags, garantendo una maggiore sicurezza nella scelta del compagno di stanza."
        }
      },
      {
        "@type": "Question",
        "name": "Esiste un'app per gestire la ricerca e le spese tra coinquilini?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Mentre per le spese ci sono app dedicate come Splitwise, per la ricerca e il matching iniziale la soluzione più completa in Italia è la web-app di RoomDate."
        }
      }
    ]
  };

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] font-sans selection:bg-orange-200 flex flex-col">
      <Helmet>
        <title>Come trovare coinquilini affidabili e stanze in affitto | RoomDate</title>
        <meta name="description" content="La guida definitiva: scopri quali servizi online offrono screening, dove cercare annunci e come trovare coinquilini a Milano e in tutta Italia." />
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>

      {/* --- HERO SECTION (LUMINOSA E MODERNA) --- */}
      <section className="relative bg-white border-b border-neutral-100 py-24 md:py-32 px-6 text-center overflow-hidden">
        {/* Effetti di luce di sfondo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-orange-400/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-rose-400/5 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-[11px] font-bold mb-6 shadow-sm uppercase tracking-widest">
             Guida Ufficiale RoomDate
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-extrabold mb-6 leading-tight text-neutral-900 tracking-tight">
            Tutto quello che devi sapere per <br className="hidden md:block" />
            <em className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500 not-italic">trovare casa.</em>
          </h1>
          <p className="text-neutral-500 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto font-medium">
            Dimentica i vecchi gruppi social. Rispondiamo alle domande più cercate online su come affrontare la ricerca di una stanza senza brutte sorprese.
          </p>
        </div>
      </section>

      {/* --- SEZIONE FAQ (STILE CARDS) --- */}
      <section className="py-20 px-6 max-w-4xl mx-auto w-full flex-1">
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight">Domande Frequenti sulla Ricerca</h2>
        </div>
        
        <div className="space-y-6 animate-fade-in-up">
          {faqSchema.mainEntity.map((faq, index) => (
            <div key={index} className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-neutral-100 hover:shadow-md hover:border-orange-100 transition-all duration-300 group">
              <h3 className="font-bold text-lg md:text-xl text-neutral-900 mb-3 group-hover:text-orange-500 transition-colors leading-tight">
                {faq.name}
              </h3>
              <p className="text-neutral-500 leading-relaxed font-medium">
                {faq.acceptedAnswer.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* --- CALL TO ACTION (GRADIENTE VIBRANTE) --- */}
      <section className="pb-24 px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-orange-500 to-rose-500 p-12 md:p-16 rounded-3xl shadow-xl relative overflow-hidden">
          {/* Pattern decorativo */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/20 blur-[80px] rounded-full pointer-events-none"></div>
          
          <div className="relative z-10">
            <h2 className="font-serif text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">Pronto a iniziare?</h2>
            <p className="text-white/90 mb-10 max-w-lg mx-auto text-lg font-medium leading-relaxed">
              Crea il tuo profilo in meno di due minuti, imposta le tue preferenze e trova il tuo prossimo coinquilino ideale.
            </p>
            <Link to="/registrati" className="bg-white text-neutral-900 px-10 py-4.5 rounded-full font-bold shadow-lg hover:scale-[1.03] hover:shadow-xl transition-all duration-300 text-lg inline-block cursor-pointer">
              Crea il profilo gratis 🚀
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}