import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function ListingDetails() {
  const { id } = useParams(); // Recupera l'ID dell'annuncio dall'URL
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simuliamo il caricamento dei dati dal backend usando l'ID
  useEffect(() => {
    // Quando avrai il backend, qui farai: fetch(`/api/listings/${id}`)
    setTimeout(() => {
      setListing({
        id: id,
        title: "Stanza singola luminosa in centro",
        price: 450,
        type: "Stanza Singola",
        location: "Milano, Porta Venezia",
        description: "Affitto ampia stanza singola in appartamento condiviso con altri due studenti. La casa è stata appena ristrutturata e dispone di tutti i comfort. Cerchiamo una persona pulita e socievole!",
        features: ["Wi-Fi ultraveloce", "Lavatrice", "Balcone", "Spese incluse"],
        images: [
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
        ],
        landlord: {
          name: "Marco Rossi",
          role: "Studente Lavoratore"
        }
      });
      setLoading(false);
    }, 500); // Finto caricamento di mezzo secondo
  }, [id]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen text-xl font-semibold">Caricamento dettagli...</div>;
  }

  if (!listing) return <div>Annuncio non trovato.</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      {/* Intestazione */}
      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-end">
        <div>
          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full uppercase tracking-wide">
            {listing.type}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-3">{listing.title}</h1>
          <p className="text-gray-500 mt-2 flex items-center text-lg">
            📍 {listing.location}
          </p>
        </div>
        <div className="mt-4 md:mt-0 text-left md:text-right">
          <p className="text-4xl font-extrabold text-blue-600">€{listing.price}<span className="text-lg text-gray-500 font-normal">/mese</span></p>
        </div>
      </div>

      {/* Immagine Principale (Galleria) */}
      <div className="rounded-2xl overflow-hidden mb-8 h-64 md:h-[400px] shadow-lg">
        <img 
          src={listing.images[0]} 
          alt="Stanza" 
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
        />
      </div>

      {/* Contenuto Principale */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Colonna di sinistra (Dettagli) */}
        <div className="md:col-span-2 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Descrizione</h2>
            <p className="text-gray-700 leading-relaxed">{listing.description}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Cosa offre questa casa</h2>
            <div className="flex flex-wrap gap-3">
              {listing.features.map((feat, index) => (
                <span key={index} className="bg-gray-100 border border-gray-200 text-gray-800 px-4 py-2 rounded-lg flex items-center gap-2">
                  ✨ {feat}
                </span>
              ))}
            </div>
          </section>
        </div>

        {/* Colonna di destra (Card Contatto) */}
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 sticky top-24">
            <h3 className="text-xl font-semibold mb-4">L'inserzionista</h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-tr from-blue-400 to-blue-600 rounded-full flex justify-center items-center text-white text-2xl font-bold shadow-md">
                {listing.landlord.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-lg">{listing.landlord.name}</p>
                <p className="text-gray-500">{listing.landlord.role}</p>
              </div>
            </div>
            
            {/* Bottone che porta alla chat */}
            <Link 
              to="/chat" 
              className="w-full block text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              Scrivi in Chat
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}