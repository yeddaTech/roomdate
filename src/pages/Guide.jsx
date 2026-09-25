import PageMeta from '../components/PageMeta';
import { Link } from 'react-router-dom';

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
          "text": "Su RoomDate ogni profilo mostra occupazione, budget, una breve presentazione e le abitudini indicate dall'utente, come fumo, animali e ordine. Leggili, fai domande in chat e incontra la persona prima di decidere: RoomDate non verifica l'identità degli utenti."
        }
      },
      {
        "@type": "Question",
        "name": "Quali piattaforme online per ricerca stanza con coinquilini esistono?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "RoomDate è una piattaforma online italiana gratuita che mette in contatto diretto chi cerca e chi offre stanze in affitto, tramite una chat cifrata end-to-end."
        }
      },
      {
        "@type": "Question",
        "name": "Dove cercare annunci di coinquilini in Italia?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Puoi cercare stanze e coinquilini direttamente su RoomDate, filtrando per città (come Milano, Roma o Bologna) e budget."
        }
      },
      {
        "@type": "Question",
        "name": "Quali servizi online offrono screening dei coinquilini?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "RoomDate non esegue screening né verifiche sugli utenti. Rispetto ai gruppi social, però, ogni profilo raccoglie in un unico posto le informazioni utili a una prima scelta: occupazione, budget, presentazione e abitudini di vita."
        }
      },
      {
        "@type": "Question",
        "name": "Esiste un'app per gestire la ricerca e le spese tra coinquilini?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Per dividere le spese esistono app dedicate come Splitwise. RoomDate si occupa della fase precedente: trovare la stanza o il coinquilino e mettersi in contatto."
        }
      }
    ]
  };

  return (
    <div className="bg-[#FAFAFA] font-sans selection:bg-orange-200 flex flex-col">
      <PageMeta title="Come trovare coinquilini affidabili e stanze in affitto | RoomDate" description="Guida pratica: dove cercare stanze e coinquilini, cosa guardare in un profilo e come contattare chi affitta, a Milano e in tutta Italia." />

      {/* --- HERO SECTION (LUMINOSA E MODERNA) --- */}
      <section className="relative bg-white border-b border-neutral-100 py-24 md:py-32 px-6 text-center overflow-hidden">
        {/* Effetti di luce di sfondo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-orange-400/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-rose-400/5 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-[11px] font-bold mb-6 shadow-xs uppercase tracking-widest">
             Guida Ufficiale RoomDate
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-extrabold mb-6 leading-tight md:leading-none text-neutral-900 tracking-tight">
            Tutto quello che devi sapere per <br className="hidden md:block" />
            <em className="text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-rose-500 not-italic">trovare casa.</em>
          </h1>
          <p className="text-neutral-500 text-lg md:text-xl leading-relaxed md:leading-7 max-w-2xl mx-auto font-medium">
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
            <div key={index} className="bg-white p-6 md:p-8 rounded-3xl shadow-xs border border-neutral-100 hover:shadow-md hover:border-orange-100 transition-all duration-300 group">
              <h3 className="font-bold text-lg md:text-xl text-neutral-900 mb-3 group-hover:text-orange-500 transition-colors leading-tight md:leading-7">
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
        <div className="max-w-4xl mx-auto text-center bg-linear-to-br from-orange-500 to-rose-500 p-12 md:p-16 rounded-3xl shadow-xl relative overflow-hidden">
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

    </div>
  );
}