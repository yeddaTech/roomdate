import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './ListingDetails.css';

export default function ListingDetails() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sostituisci questa finta fetch con la tua chiamata API reale
    // fetch(`/api/listings/${id}`).then(res => res.json()).then(data => {...})
    
    // Simulazione dati per vedere l'effetto grafico
    setTimeout(() => {
      setListing({
        title: "Singola luminosa con vista",
        city: "Milano",
        zone: "Porta Venezia",
        price: 650,
        type: "Stanza Singola",
        desc: "Situata nel cuore vibrante della città, questa stanza offre il perfetto equilibrio tra tranquillità e vita urbana. Arredamento moderno e spese incluse.",
        features: ["Wi-Fi 1Gbps", "Climatizzatore", "Lavatrice", "Balcone privato"],
        landlord: { name: "Marco B.", role: "Lavoratore", emoji: "👨" }
      });
      setLoading(false);
    }, 400);
  }, [id]);

  if (loading) return (
    <div className="details-page" style={{display:'flex', justifyContent:'center', alignItems:'center'}}>
      <div className="serif" style={{color:'var(--t)', fontSize:'1.5rem'}}>Caricamento...</div>
    </div>
  );

  return (
    <div className="details-page">
      {/* HERO SECTION */}
      <section className="details-hero">
        <div className="dot-grid"></div>
        <div className="breadcrumb">
          <Link to="/">Home</Link> / <Link to="/ricerca">Stanze</Link> / {listing.city}
        </div>
        <h1 className="serif" style={{fontSize: '2.5rem'}}>{listing.title}</h1>
        <p style={{opacity: 0.9}}>📍 {listing.zone}, {listing.city}</p>
      </section>

      {/* MAIN CONTENT */}
      <div className="details-container">
        
        <div className="content-left">
          {/* Immagine con decorazione */}
          <div className="main-image-wrapper">
            <img 
              src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80" 
              alt="Stanza" 
              className="main-image"
            />
          </div>

          {/* Dettagli */}
          <div className="info-card">
            <h2 className="serif">Descrizione immobile</h2>
            <p style={{lineHeight: 1.8, color: 'var(--wg)'}}>{listing.desc}</p>
            
            <div style={{marginTop: '2.5rem'}}>
              <h3 className="serif" style={{marginBottom: '1rem', fontSize: '1.2rem'}}>Comfort inclusi</h3>
              <div className="features-grid">
                {listing.features.map(f => (
                  <div key={f} className="feature-item">
                    <span style={{color: 'var(--t)'}}>✦</span> {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <aside className="landlord-sidebar">
          <div className="contact-card">
            <div className="price-tag">
              <div className="amount">€{listing.price}</div>
              <div style={{fontSize: '0.8rem', color: 'var(--wg)'}}>prezzo tutto incluso al mese</div>
            </div>

            <div className="landlord-av">{listing.landlord.emoji}</div>
            <h3 className="serif">{listing.landlord.name}</h3>
            <p style={{fontSize: '0.85rem', color: 'var(--wg)', marginBottom: '1.5rem'}}>
              Inserzionista · {listing.landlord.role}
            </p>

            <Link to="/chat" className="btn-fill" style={{display:'block', width:'100%', marginBottom: '1rem', textDecoration:'none'}}>
              Invia Messaggio
            </Link>
            
            <button className="btn-ghost" style={{width:'100%'}}>
              Salva nei preferiti
            </button>
          </div>

          <p style={{textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--wg)'}}>
            🛡️ RoomDate protegge i tuoi dati. Non condividere mai denaro fuori dalla nostra piattaforma.
          </p>
        </aside>

      </div>
    </div>
  );
}