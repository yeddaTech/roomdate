import React from 'react';

const steps = [
  {
    n: '01',
    icon: '📝',
    title: 'Crea il tuo profilo',
    desc: 'Raccontaci di te: stile di vita, abitudini e preferenze. Più sei specifico, migliori saranno i match.',
  },
  {
    n: '02',
    icon: '🔍',
    title: 'Cerca e filtra',
    desc: 'Usa i nostri filtri intelligenti per trovare stanze o coinquilini in base a budget, zona e compatibilità.',
  },
  {
    n: '03',
    icon: '💬',
    title: 'Contatta e conosci',
    desc: 'Chatta direttamente con i proprietari o i potenziali coinquilini. Nessun intermediario.',
  },
  {
    n: '04',
    icon: '🏠',
    title: 'Benvenuto a casa!',
    desc: 'Firma l\'accordo, prendi le chiavi e inizia la tua nuova convivenza. È così semplice.',
  },
];

const HowItWorks = () => (
  <section style={{ background: 'linear-gradient(160deg, var(--sand) 0%, var(--sand-light) 100%)', padding: '7rem 0', position: 'relative', overflow: 'hidden' }}>

    {/* Decorative circle */}
    <div style={{
      position: 'absolute', top: '-15%', right: '-10%',
      width: 500, height: 500, borderRadius: '50%',
      border: '2px solid var(--terra)', opacity: 0.06,
    }} />
    <div style={{
      position: 'absolute', top: '-5%', right: '-5%',
      width: 350, height: 350, borderRadius: '50%',
      border: '2px solid var(--terra)', opacity: 0.06,
    }} />

    <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
      {/* Header */}
      <div className="text-center mb-16">
        <span style={{ color: 'var(--terra)', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Come funziona
        </span>
        <h2 className="font-display mt-2" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: 'var(--warm-dark)' }}>
          Trovare casa non è mai stato così semplice
        </h2>
        <p style={{ color: 'var(--warm-gray)', marginTop: 12, fontSize: '1.05rem', maxWidth: 480, margin: '12px auto 0' }}>
          In soli 4 passi trovi la stanza dei tuoi sogni o il coinquilino perfetto.
        </p>
      </div>

      {/* Steps */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {steps.map((step, i) => (
          <div key={i} style={{ position: 'relative' }}>
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="hidden lg:block" style={{
                position: 'absolute', top: 36, left: '75%',
                width: '50%', height: 2,
                background: 'linear-gradient(90deg, var(--terra) 0%, transparent 100%)',
                opacity: 0.25, zIndex: 0,
              }} />
            )}

            <div
              style={{
                background: 'white',
                borderRadius: '1.25rem',
                padding: '2rem 1.5rem',
                boxShadow: '0 2px 20px rgba(122,75,42,0.07)',
                position: 'relative', zIndex: 1,
                border: '1px solid rgba(196,96,58,0.08)',
                transition: 'all 0.3s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(122,75,42,0.15)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 20px rgba(122,75,42,0.07)';
              }}
            >
              {/* Step number */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 48, height: 48, borderRadius: '0.875rem',
                background: 'var(--sand-light)',
                marginBottom: '1rem',
              }}>
                <span style={{ fontSize: '1.6rem' }}>{step.icon}</span>
              </div>

              <div style={{
                position: 'absolute', top: '1.2rem', right: '1.2rem',
                fontFamily: 'Playfair Display, serif',
                fontSize: '2rem', fontWeight: 700,
                color: 'var(--terra)', opacity: 0.12,
              }}>
                {step.n}
              </div>

              <h3 className="font-display font-semibold" style={{ color: 'var(--warm-dark)', fontSize: '1.1rem', marginBottom: '0.6rem' }}>
                {step.title}
              </h3>
              <p style={{ color: 'var(--warm-gray)', fontSize: '0.88rem', lineHeight: 1.7 }}>
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--terra) 0%, var(--terra-dark) 100%)',
        borderRadius: '1.5rem',
        padding: '3rem',
        marginTop: '4rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', top:'-40%', right:'-5%', width:300, height:300, borderRadius:'50%', background:'white', opacity:0.04 }} />
        <div style={{ position:'absolute', bottom:'-30%', left:'5%', width:200, height:200, borderRadius:'50%', background:'white', opacity:0.04 }} />

        <h3 className="font-display" style={{ color: 'white', fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', position:'relative', zIndex:1 }}>
          Pronto a trovare la tua prossima casa?
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 400, fontSize: '0.95rem', position:'relative', zIndex:1 }}>
          Registrazione gratuita. Nessuna carta di credito richiesta.
        </p>
        <button style={{
          background: 'white', color: 'var(--terra)',
          padding: '0.85rem 2.5rem', borderRadius: 9999,
          fontWeight: 700, fontSize: '1rem',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          position: 'relative', zIndex: 1,
          fontFamily: 'inherit',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          Inizia ora — è gratis 🚀
        </button>
      </div>
    </div>
  </section>
);

export default HowItWorks;