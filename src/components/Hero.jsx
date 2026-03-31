import React, { useState } from 'react';

const cities = ['Milano', 'Roma', 'Torino', 'Bologna', 'Firenze', 'Napoli'];

const Hero = () => {
  const [activeTab, setActiveTab] = useState('stanza');
  const [city, setCity] = useState('');

  return (
    <section
      style={{ background: 'linear-gradient(160deg, var(--sand-light) 0%, var(--cream) 60%)' }}
      className="relative min-h-screen flex items-center overflow-hidden pt-20"
    >
      {/* Decorative blobs */}
      <div
        style={{
          position: 'absolute', top: '8%', right: '-5%',
          width: 480, height: 480, borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%',
          background: 'var(--terra)', opacity: 0.08,
        }}
      />
      <div
        style={{
          position: 'absolute', bottom: '-10%', left: '-8%',
          width: 400, height: 400, borderRadius: '45% 55% 40% 60% / 55% 45% 55% 45%',
          background: 'var(--sand)', opacity: 0.5,
        }}
      />
      <div
        style={{
          position: 'absolute', top: '45%', right: '15%',
          width: 120, height: 120, borderRadius: '50%',
          background: 'var(--terra-light)', opacity: 0.12,
        }}
      />

      {/* Dotted pattern */}
      <div style={{
        position: 'absolute', top: '15%', left: '5%',
        backgroundImage: 'radial-gradient(circle, var(--terra) 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px',
        width: 180, height: 180, opacity: 0.12,
      }} />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: Text + Search */}
          <div>
            {/* Badge */}
            <div className="animate-fadeup delay-1 inline-flex items-center gap-2 mb-8">
              <span style={{
                background: 'var(--sand)', color: 'var(--terra)',
                padding: '0.35rem 1rem', borderRadius: 9999,
                fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.02em'
              }}>
                🏡 Oltre 12.000 annunci attivi
              </span>
            </div>

            <h1
              className="font-display animate-fadeup delay-2"
              style={{ fontSize: 'clamp(2.6rem, 5vw, 3.8rem)', lineHeight: 1.15, color: 'var(--warm-dark)' }}
            >
              Trova la tua stanza,<br />
              <em style={{ color: 'var(--terra)', fontStyle: 'italic' }}>trova casa.</em>
            </h1>

            <p
              className="animate-fadeup delay-3 mt-6"
              style={{ fontSize: '1.1rem', color: 'var(--warm-gray)', lineHeight: 1.75, maxWidth: 480 }}
            >
              Migliaia di stanze e coinquilini selezionati nelle città italiane.
              Senza agenzie, senza commissioni. Solo connessioni vere.
            </p>

            {/* Search Box */}
            <div
              className="animate-fadeup delay-4 mt-10"
              style={{
                background: 'white',
                borderRadius: '1.5rem',
                padding: '1.5rem',
                boxShadow: '0 8px 40px rgba(122,75,42,0.12)',
                maxWidth: 520,
              }}
            >
              {/* Tabs */}
              <div
                style={{
                  background: 'var(--sand-light)',
                  borderRadius: 9999,
                  padding: '0.3rem',
                  display: 'inline-flex',
                  marginBottom: '1.2rem',
                }}
              >
                <button
                  className={`search-tab ${activeTab === 'stanza' ? 'active' : ''}`}
                  onClick={() => setActiveTab('stanza')}
                >
                  🔍 Cerca Stanza
                </button>
                <button
                  className={`search-tab ${activeTab === 'coinquilino' ? 'active' : ''}`}
                  onClick={() => setActiveTab('coinquilino')}
                >
                  👥 Cerco Coinquilino
                </button>
              </div>

              {/* Inputs */}
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  style={{
                    flex: 1, padding: '0.8rem 1rem',
                    borderRadius: '0.875rem', border: '1.5px solid var(--sand)',
                    background: 'var(--sand-light)', color: city ? 'var(--warm-dark)' : 'var(--warm-gray)',
                    fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit',
                  }}
                >
                  <option value="">📍 Scegli città</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <input
                  type="number"
                  placeholder="💶 Budget max"
                  style={{
                    flex: 1, padding: '0.8rem 1rem',
                    borderRadius: '0.875rem', border: '1.5px solid var(--sand)',
                    background: 'var(--sand-light)',
                    fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit',
                    color: 'var(--warm-dark)',
                  }}
                />
              </div>

              <button className="btn-primary w-full mt-4" style={{ borderRadius: '0.875rem', padding: '0.9rem' }}>
                {activeTab === 'stanza' ? 'Cerca Stanze Disponibili' : 'Trova Coinquilini'}
              </button>
            </div>

            {/* Stats row */}
            <div className="animate-fadeup delay-4 flex gap-8 mt-8">
              {[
                { n: '12K+', label: 'Annunci attivi' },
                { n: '98%', label: 'Utenti soddisfatti' },
                { n: '0€',  label: 'Commissioni' },
              ].map(s => (
                <div key={s.n}>
                  <div className="font-display font-bold" style={{ fontSize: '1.6rem', color: 'var(--terra)' }}>{s.n}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--warm-gray)', fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Illustration Cards */}
          <div className="hidden lg:block relative h-[560px]">
            {/* Main card */}
            <div className="card-warm absolute" style={{ top: 40, left: 20, width: 280 }}>
              <div style={{ height: 160, background: 'linear-gradient(135deg, #E8C4A0 0%, #D4835E 100%)', position: 'relative' }}>
                <span style={{ position:'absolute', top:12, left:12, background:'white', borderRadius:9999, padding:'0.2rem 0.7rem', fontSize:'0.75rem', fontWeight:600, color:'var(--terra)' }}>Disponibile</span>
                <div style={{ position:'absolute', bottom:12, right:12, background:'white', borderRadius:9999, padding:'0.2rem 0.7rem', fontSize:'0.8rem', fontWeight:700, color:'var(--warm-dark)' }}>€650/mese</div>
              </div>
              <div style={{ padding: '1rem 1.2rem' }}>
                <div className="font-display font-semibold" style={{ color:'var(--warm-dark)', fontSize:'1.05rem' }}>Stanza Luminosa</div>
                <div style={{ color:'var(--warm-gray)', fontSize:'0.82rem', marginTop:2 }}>📍 Navigli, Milano</div>
                <div className="flex gap-2 mt-3">
                  <span className="tag">Wi-Fi</span>
                  <span className="tag">Arredata</span>
                  <span className="tag">Balcone</span>
                </div>
              </div>
            </div>

            {/* Second card */}
            <div className="card-warm absolute" style={{ top: 220, right: 0, width: 260 }}>
              <div style={{ padding: '1.2rem' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg, #F5C29A, #C4603A)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>👤</div>
                  <div>
                    <div className="font-semibold" style={{ color:'var(--warm-dark)', fontSize:'0.95rem' }}>Martina, 26</div>
                    <div style={{ color:'var(--warm-gray)', fontSize:'0.78rem' }}>Studentessa · Bologna</div>
                  </div>
                </div>
                <p style={{ fontSize:'0.82rem', color:'var(--warm-gray)', lineHeight:1.6 }}>
                  "Cerco coinquilina tranquilla, amante dei gatti 🐱"
                </p>
                <div className="flex gap-2 mt-3">
                  <span className="tag">Non fumatrice</span>
                  <span className="tag">Animali ok</span>
                </div>
              </div>
            </div>

            {/* Small floating badge */}
            <div style={{
              position:'absolute', top:0, right:60,
              background:'white', borderRadius:'1rem', padding:'0.75rem 1rem',
              boxShadow:'0 4px 20px rgba(122,75,42,0.15)',
              display:'flex', alignItems:'center', gap:'0.5rem',
            }}>
              <span style={{ fontSize:'1.3rem' }}>✨</span>
              <div>
                <div style={{ fontWeight:700, fontSize:'0.85rem', color:'var(--warm-dark)' }}>Match trovato!</div>
                <div style={{ fontSize:'0.72rem', color:'var(--warm-gray)' }}>3 profili compatibili</div>
              </div>
            </div>

            {/* Review badge */}
            <div style={{
              position:'absolute', bottom:60, left:10,
              background:'white', borderRadius:'1rem', padding:'0.75rem 1rem',
              boxShadow:'0 4px 20px rgba(122,75,42,0.15)',
            }}>
              <div style={{ fontSize:'0.75rem', color:'var(--warm-gray)', marginBottom:4 }}>Valutazione media</div>
              <div className="flex items-center gap-1">
                {'⭐⭐⭐⭐⭐'.split('').map((s,i) => <span key={i} style={{ fontSize:'0.9rem' }}>{s}</span>)}
                <span style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--warm-dark)', marginLeft:4 }}>4.9</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;