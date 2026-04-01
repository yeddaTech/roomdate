import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './ListingDetails.css';

export default function ListingDetails() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Sostituisci questo blocco con la chiamata fetch reale al tuo database
    // Esempio: fetch(`/api/annunci/${id}`).then(...)
    
    setTimeout(() => {
      setListing({
        title: "Stanza Singola Premium",
        city: "Milano",
        zone: "Porta Venezia",
        price: 720,
        type: "Singola",
        description: "Ampia stanza luminosa situata in un appartamento storico appena ristrutturato. La zona è centralissima, servita da metro e locali, perfetta per studenti o giovani professionisti.",
        features: ["Wi-Fi 1Gbps", "Aria Condizionata", "Lavatrice", "Scrivania XL", "Pulizie incluse"],
        images: [
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80"
        ],
        landlord: { name: "Giulia R.", role: "Proprietaria", emoji: "👩‍💼" }
      });
      setLoading(false);
    }, 500);
  }, [id]);

  // Logica navigazione immagini
  const nextImage = () => {
    setCurrentIndex((prev) => (prev === listing.images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev === 0 ? listing.images.length - 1 : prev - 1));
  };

  if (loading) {
    return (
      <div className="details-page" style={{display:'flex', justifyContent:'center', alignItems:'center'}}>
        <div className="serif" style={{color:'var(--t)', fontSize:'1.8rem'}}>Caricamento...</div>
      </div>
    );
  }

  if (!listing) return <div className="details-page">Annuncio non trovato.</div>;

  return (
    <div className="details-page">
      {/* TESTATA COLORATA */}
      <section className="details-hero">
        <div className="dot-grid"></div>
        <div className="breadcrumb">
          <Link to="/">Home</Link> / <span>{listing.city}</span> / <span>{listing.type}</span>
        </div>
        <h1 className="serif" style={{fontSize: '2.8rem'}}>{listing.title}</h1>
        <p className="serif" style={{fontSize: '1.2rem', opacity: 0.9}}>
          📍 {listing.zone}, {listing.city}
        </p>
      </section>

      <div className="details-container">
        
        {/* COLONNA SINISTRA: FOTO E INFO */}
        <div className="content-left">
          
          <div className="main-image-wrapper">
            <div className="slider-container">
              {listing.images.length > 1 && (
                <>
                  <button className="nav-arrow prev-arrow" onClick={prevImage}>❮</button>
                  <button className="nav-arrow next-arrow" onClick={nextImage}>❯</button>
                </>
              )}
              
              <img 
                src={listing.images[currentIndex]} 
                alt={`Foto ${currentIndex + 1}`} 
                className="main-image"
              />

              <div className="slider-dots">
                {listing.images.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`dot ${currentIndex === idx ? 'active' : ''}`}
                    onClick={() => setCurrentIndex(idx)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="info-card">
            <h2 className="section-title serif">Descrizione immobile</h2>
            <p style={{lineHeight: 1.8, color: 'var(--wg)', fontSize: '1.05rem'}}>
              {listing.description}
            </p>
            
            <div style={{marginTop: '3rem'}}>
              <h3 className="section-title serif" style={{fontSize: '1.3rem'}}>Cosa offre la stanza</h3>
              <div className="features-grid">
                {listing.features.map(f => (
                  <div key={f} className="feature-item">
                    <span style={{fontSize:'1.2rem'}}>✦</span> {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA: PREZZO E CONTATTO */}
        <aside className="landlord-sidebar">
          <div className="contact-card">
            <div className="price-tag">
              <span className="amount">€{listing.price}</span>
              <span style={{fontSize: '0.85rem', color: 'var(--wg)', fontWeight: 500}}>
                al mese (tutto incluso)
              </span>
            </div>

            <div className="landlord-av">{listing.landlord.emoji}</div>
            <h3 className="serif" style={{fontSize: '1.4rem'}}>{listing.landlord.name}</h3>
            <p style={{fontSize: '0.9rem', color: 'var(--wg)', marginBottom: '2rem'}}>
              {listing.landlord.role} su RoomDate
            </p>

            <Link 
              to="/chat" 
              className="btn-fill" 
              style={{display:'block', textDecoration:'none', marginBottom: '1rem', padding: '1rem'}}
            >
              Contatta in Chat
            </Link>
            
            <button className="btn-ghost" style={{width:'100%', padding: '0.9rem'}}>
              Salva tra i preferiti
            </button>
          </div>

          <div style={{
            marginTop: '2rem', textAlign: 'center', padding: '1rem', 
            background: 'var(--sl)', borderRadius: '1rem', fontSize: '0.8rem', color: 'var(--wb)'
          }}>
            🔒 <strong>Prenota in sicurezza:</strong> non inviare mai denaro a conti privati prima di aver visto la stanza.
          </div>
        </aside>

      </div>
    </div>
  );
}