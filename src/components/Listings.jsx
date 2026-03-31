import React, { useState } from 'react';

const listings = [
  { id: 1, title: 'Doppia con bagno privato', city: 'Milano', zone: 'Porta Romana', price: 750, tags: ['Arredata', 'Bagno privato', 'Wi-Fi'], color: '#E8C4A0', emoji: '🏢', available: true },
  { id: 2, title: 'Singola luminosa', city: 'Roma', zone: 'Prati', price: 620, tags: ['Arredata', 'Terrazza', 'Palestra'], color: '#C4A882', emoji: '🌿', available: true },
  { id: 3, title: 'Posto letto in doppia', city: 'Torino', zone: 'San Salvario', price: 380, tags: ['Studenti', 'Animali ok', 'Bici'], color: '#D4B896', emoji: '🚲', available: false },
  { id: 4, title: 'Singola in attico', city: 'Bologna', zone: 'Centro', price: 550, tags: ['Arredata', 'Vista città', 'Wi-Fi'], color: '#B89878', emoji: '✨', available: true },
  { id: 5, title: 'Doppia uso singola', city: 'Firenze', zone: 'Oltrarno', price: 690, tags: ['Arredata', 'Storico', 'Cortile'], color: '#C4A07A', emoji: '🌺', available: true },
  { id: 6, title: 'Singola moderna', city: 'Milano', zone: 'Isola', price: 820, tags: ['Design', 'Palestra', 'Sicurezza'], color: '#D8B898', emoji: '🏙️', available: true },
];

const cities = ['Tutte', 'Milano', 'Roma', 'Torino', 'Bologna', 'Firenze'];

const Listings = () => {
  const [filter, setFilter] = useState('Tutte');

  const filtered = filter === 'Tutte' ? listings : listings.filter(l => l.city === filter);

  return (
    <section style={{ background: 'var(--cream)', padding: '6rem 0' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <span style={{ color: 'var(--terra)', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Annunci in evidenza
            </span>
            <h2 className="font-display mt-2" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: 'var(--warm-dark)' }}>
              Stanze selezionate per te
            </h2>
          </div>

          {/* City filters */}
          <div className="flex flex-wrap gap-2">
            {cities.map(c => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                style={{
                  padding: '0.4rem 1.2rem',
                  borderRadius: 9999,
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  border: '1.5px solid',
                  borderColor: filter === c ? 'var(--terra)' : 'var(--sand)',
                  background: filter === c ? 'var(--terra)' : 'white',
                  color: filter === c ? 'white' : 'var(--warm-gray)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(listing => (
            <div key={listing.id} className="card-warm cursor-pointer">
              {/* Image area */}
              <div style={{
                height: 180,
                background: `linear-gradient(135deg, ${listing.color} 0%, ${listing.color}99 100%)`,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: '3.5rem', opacity: 0.7 }}>{listing.emoji}</span>
                <div style={{ position: 'absolute', top: 12, left: 12 }}>
                  <span style={{
                    background: listing.available ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.15)',
                    color: listing.available ? 'var(--terra-dark)' : 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: 9999,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}>
                    {listing.available ? '✅ Disponibile' : '⏳ Occupata'}
                  </span>
                </div>
                <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'white', borderRadius: '0.75rem', padding: '0.3rem 0.8rem' }}>
                  <span className="font-display" style={{ fontWeight: 700, color: 'var(--terra)', fontSize: '1rem' }}>€{listing.price}</span>
                  <span style={{ color: 'var(--warm-gray)', fontSize: '0.75rem' }}>/mese</span>
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: '1.2rem 1.4rem' }}>
                <h3 className="font-display font-semibold" style={{ color: 'var(--warm-dark)', fontSize: '1.05rem' }}>
                  {listing.title}
                </h3>
                <p style={{ color: 'var(--warm-gray)', fontSize: '0.83rem', marginTop: 4 }}>
                  📍 {listing.zone}, {listing.city}
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {listing.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
                <button
                  className="btn-outline w-full mt-4"
                  style={{ padding: '0.6rem', fontSize: '0.88rem', borderRadius: '0.75rem' }}
                >
                  Vedi dettagli
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <button className="btn-primary" style={{ padding: '0.9rem 2.5rem', fontSize: '1rem' }}>
            Vedi tutti gli annunci →
          </button>
        </div>
      </div>
    </section>
  );
};

export default Listings;