import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  // 1. Mappiamo le colonne di destra con i path reali dell'app
  const menuColumns = [
    {
      title: 'Servizi',
      links: [
        { text: 'Cerca Stanza', to: '/ricerca', isInternal: true },
        { text: 'Pubblica Annuncio', to: '#', isInternal: false },
        { text: 'Trova Coinquilini', to: '/ricerca', isInternal: true },
        { text: 'Mappa Interattiva', to: '#', isInternal: false },
      ],
    },
    {
      title: 'Supporto',
      links: [
        { text: 'Come Funziona', to: '#', isInternal: false },
        { text: 'FAQ', to: '#', isInternal: false },
        { text: 'Sicurezza', to: '/privacy', isInternal: true }, // Collegato alla Privacy Policy!
        { text: 'Contattaci', to: '#', isInternal: false },
      ],
    },
    {
      title: 'Azienda',
      links: [
        { text: 'Chi Siamo', to: '#', isInternal: false },
        { text: 'Blog', to: '#', isInternal: false },
        { text: 'Lavora con Noi', to: '#', isInternal: false },
        { text: 'Press Kit', to: '#', isInternal: false },
      ],
    },
  ];

  const bottomLinks = [
    { text: 'Privacy Policy', to: '/privacy', isInternal: true },
    { text: 'Termini di Servizio', to: '#', isInternal: false },
    { text: 'Cookie', to: '#', isInternal: false },
  ];

  return (
    <footer style={{ background: 'var(--warm-dark)', color: 'rgba(255,255,255,0.7)', padding: '4rem 0 2rem' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div style={{ background: 'var(--terra)', width: 32, height: 32, borderRadius: 8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" fill="white" opacity="0.9"/>
                </svg>
              </div>
              <span className="font-display text-xl font-bold text-white">
                Room<span style={{ color: 'var(--terra-light)' }}>Date</span>
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.75, maxWidth: 220 }}>
              Il modo più semplice per trovare stanze e coinquilini in Italia.
            </p>
            <div className="flex gap-3 mt-5">
              {['📘', '📸', '🐦', '💼'].map((icon, i) => (
                <button key={i} style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)', border: 'none',
                  cursor: 'pointer', fontSize: '1rem', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(196,96,58,0.4)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Links a Destra Sistemati */}
          {menuColumns.map(col => (
            <div key={col.title}>
              <h4 style={{ color: 'white', fontWeight: 600, marginBottom: '1rem', fontSize: '0.9rem', letterSpacing:'0.03em' }}>{col.title}</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {col.links.map(link => {
                  const linkProps = {
                    style: {
                      fontSize: '0.85rem', textDecoration: 'none', color: 'rgba(255,255,255,0.6)',
                      transition: 'color 0.2s',
                    },
                    onMouseEnter: e => e.currentTarget.style.color='var(--terra-light)',
                    onMouseLeave: e => e.currentTarget.style.color='rgba(255,255,255,0.6)',
                  };

                  return (
                    <li key={link.text}>
                      {link.isInternal ? (
                        <Link to={link.to} {...linkProps}>{link.text}</Link>
                      ) : (
                        <a href={link.to} {...linkProps}>{link.text}</a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem' }}>© 2026 RoomDate. Tutti i diritti riservati.</span>
          <div className="flex gap-4">
            {bottomLinks.map(item => {
              const sharedProps = {
                key: item.text,
                style: { fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' },
                onMouseEnter: e => e.currentTarget.style.color = 'var(--terra-light)',
                onMouseLeave: e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
              };

              return item.isInternal ? (
                <Link to={item.to} {...sharedProps}>{item.text}</Link>
              ) : (
                <a href={item.to} {...sharedProps}>{item.text}</a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;