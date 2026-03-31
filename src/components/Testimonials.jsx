import React from 'react';

const reviews = [
  {
    name: 'Giulia M.',
    age: 24,
    city: 'Milano',
    avatar: '🧑‍🦱',
    color: '#E8C4A0',
    stars: 5,
    text: 'Ho trovato la stanza perfetta in meno di una settimana! Il sistema di filtri è comodissimo e la chat con il proprietario è stata subito aperta e trasparente.',
  },
  {
    name: 'Lorenzo B.',
    age: 28,
    city: 'Roma',
    avatar: '👨‍💼',
    color: '#C4A882',
    stars: 5,
    text: 'Ero scettico, ma RoomDate mi ha sorpreso. Ho trovato due coinquilini fantastici con cui condivido l\'appartamento da 8 mesi. Zero agenzie, zero commissioni.',
  },
  {
    name: 'Sara K.',
    age: 22,
    city: 'Bologna',
    avatar: '👩‍🎓',
    color: '#D4B896',
    stars: 5,
    text: 'Per una studentessa fuori sede è stato essenziale. Profili verificati, prezzi chiari e ho potuto fare un tour virtuale prima ancora di visitare la stanza.',
  },
];

const Testimonials = () => (
  <section style={{ background: 'var(--cream)', padding: '6rem 0' }}>
    <div className="max-w-7xl mx-auto px-6 lg:px-8">

      {/* Header */}
      <div className="text-center mb-14">
        <span style={{ color: 'var(--terra)', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Testimonianze
        </span>
        <h2 className="font-display mt-2" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: 'var(--warm-dark)' }}>
          Cosa dicono i nostri utenti
        </h2>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {reviews.map((r, i) => (
          <div key={i} style={{
            background: 'white',
            borderRadius: '1.25rem',
            padding: '2rem',
            boxShadow: '0 2px 20px rgba(122,75,42,0.07)',
            border: '1px solid rgba(196,96,58,0.06)',
            transition: 'all 0.3s',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 8px 32px rgba(122,75,42,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 2px 20px rgba(122,75,42,0.07)'; }}
          >
            {/* Quote mark */}
            <div style={{
              position: 'absolute', top: '1rem', right: '1.5rem',
              fontFamily: 'Georgia, serif', fontSize: '5rem', lineHeight: 1,
              color: 'var(--terra)', opacity: 0.08, fontWeight: 900,
            }}>
              "
            </div>

            {/* Stars */}
            <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              {'⭐'.repeat(r.stars)}
            </div>

            {/* Text */}
            <p style={{ color: 'var(--warm-gray)', fontSize: '0.92rem', lineHeight: 1.75, marginBottom: '1.5rem' }}>
              "{r.text}"
            </p>

            {/* Author */}
            <div className="flex items-center gap-3">
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: `linear-gradient(135deg, ${r.color}, ${r.color}99)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem', flexShrink: 0,
              }}>
                {r.avatar}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--warm-dark)', fontSize: '0.92rem' }}>{r.name}</div>
                <div style={{ color: 'var(--warm-gray)', fontSize: '0.78rem' }}>{r.age} anni · {r.city}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trust bar */}
      <div style={{
        marginTop: '4rem',
        background: 'var(--sand-light)',
        borderRadius: '1.25rem',
        padding: '2rem 3rem',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        gap: '1.5rem',
        alignItems: 'center',
      }}>
        {[
          { icon: '🔒', label: 'Profili verificati' },
          { icon: '💬', label: 'Chat sicura' },
          { icon: '⭐', label: '4.9/5 su 2.400+ recensioni' },
          { icon: '🛡️', label: 'Annunci controllati' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
            <span style={{ fontWeight: 500, color: 'var(--warm-brown)', fontSize: '0.9rem' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Testimonials;