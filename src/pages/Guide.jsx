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
    <div className="min-h-screen bg-[#FEFAF4] font-sans">
      <Helmet>
        <title>Come trovare coinquilini affidabili e stanze in affitto | RoomDate</title>
        <meta name="description" content="La guida definitiva: scopri quali servizi online offrono screening, dove cercare annunci e come trovare coinquilini a Milano e in tutta Italia." />
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#2C1A0E] to-[#5A2C1A] text-white py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="text-[#D4835E] font-bold tracking-widest uppercase text-sm mb-4">Guida Ufficiale RoomDate</div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Tutto quello che devi sapere per <em className="text-[#F5E3CC] font-light">trovare casa.</em>
          </h1>
          {/* Contrasto migliorato: text-white/90 invece di text-white/80 */}
          <p className="text-white/90 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            Dimentica i vecchi gruppi Facebook. Rispondiamo alle domande più cercate online su come affrontare la ricerca di una stanza senza brutte sorprese.
          </p>
        </div>
      </section>

      {/* Sezione FAQ Dinamica */}
      <section className="py-20 px-6 max-w-4xl mx-auto">
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-neutral-100">
          <h2 className="font-serif text-3xl font-bold text-[#2C1A0E] mb-8 text-center">Domande Frequenti sulla Ricerca</h2>
          
          <div className="space-y-6">
            {/* Mappiamo le domande per mostrarle anche visivamente */}
            {faqSchema.mainEntity.map((faq, index) => (
              <div key={index} className="border-b border-neutral-100 pb-6 last:border-0 last:pb-0">
                <h3 className="font-bold text-lg text-[#C4603A] mb-3">{faq.name}</h3>
                {/* Contrasto migliorato: text-[#5C5249] invece di text-[#8A7B6E] */}
                <p className="text-[#5C5249] leading-relaxed">{faq.acceptedAnswer.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center bg-[#FEFAF4] border-2 border-[#C4603A] p-12 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="font-serif text-3xl font-bold text-[#2C1A0E] mb-4">Pronto a iniziare?</h2>
            {/* Contrasto migliorato: text-[#5C5249] invece di text-[#8A7B6E] */}
            <p className="text-[#5C5249] mb-8 max-w-lg mx-auto">
              Crea il tuo profilo in meno di due minuti, imposta le tue preferenze e trova il tuo prossimo coinquilino ideale.
            </p>
            <Link to="/registrati" className="bg-[#C4603A] text-white px-8 py-4 rounded-full font-bold shadow-md hover:bg-[#9A4628] transition-all text-lg">
              Crea il profilo gratis 🚀
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}