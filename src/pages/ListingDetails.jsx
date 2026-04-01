import React, { useState, useEffect } from 'react';
// 1. HO AGGIUNTO useNavigate QUI SOTTO
import { useParams, Link, useNavigate } from 'react-router-dom'; 
import './ListingDetails.css';

export default function ListingDetails() {
  const { id } = useParams();
  const navigate = useNavigate(); // 2. HO ATTIVATO IL NAVIGATORE QUI
  
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
      // CHIAMATA REALE AL DATABASE
      fetch(`/api/get_listing?id=${id}`)
        .then(res => {
          if (!res.ok) throw new Error('Annuncio non trovato');
          return res.json();
        })
        .then(data => {
          setListing(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Errore nel caricamento dei dati veri:", err);
          setLoading(false);
        });
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
        
        {/* 3. HO AGGIUNTO IL BOTTONE INDIETRO QUI, ASSIEME AL BREADCRUMB */}
        <div className="details-nav-bar">
          <button onClick={() => navigate(-1)} className="btn-back">
            ← Torna indietro
          </button>
          
          <div className="breadcrumb">
            <Link to="/">Home</Link> / <span>{listing.city}</span> / <span>{listing.type}</span>
          </div>
        </div>

        <h1 className="serif" style={{fontSize: '2.8rem'}}>{listing.title}</h1>
        <p className="serif location-sub" style={{fontSize: '1.2rem', opacity: 0.9}}>
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