import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  // Funzione per tornare in cima quando si clicca un link
  const handleScrollTop = () => window.scrollTo(0, 0);

  // 1. Mappiamo le colonne di destra
  const menuColumns = [
    {
      title: 'Piattaforma',
      links: [
        { text: 'Stanze disponibili', to: '/ricerca', isInternal: true },
        { text: 'Cerca coinquilini', to: '/ricerca?intent=coinquilino', isInternal: true },
        { text: 'La tua dashboard', to: '/dashboard', isInternal: true },
      ],
    },
    {
      title: 'Info',
      links: [
        { text: 'Linee Guida', to: '#', isInternal: false },
        { text: 'Sicurezza e Privacy', to: '/privacy', isInternal: true }, // <-- Link corretto alla Privacy
        { text: 'Supporto Tecnico', to: '#', isInternal: false },
      ],
    }
  ];

  // 2. Link della barra in basso
  const bottomLinks = [
    { text: 'Privacy Policy', to: '/privacy', isInternal: true }, // <-- Link corretto alla Privacy
    { text: 'Termini di Servizio', to: '#', isInternal: false },
    { text: 'Cookie', to: '#', isInternal: false },
  ];

  return (
    <footer className="bg-[#1A0E07] pt-16 pb-8 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          
          {/* Colonna 1: Brand e Descrizione */}
          <div className="col-span-1 md:col-span-2">
            <div className="font-serif text-2xl font-bold tracking-tight text-white mb-4">
              Room<span className="text-[#D4835E]">Date</span>
            </div>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs mb-6">
              Il modo più trasparente per trovare stanze e coinquilini in Italia.
            </p>
            {/* Icone Social */}
            <div className="flex gap-3">
              {['📘', '📸', '🐦', '💼'].map((icon, i) => (
                <button 
                  key={i} 
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-[#C4603A] flex items-center justify-center transition-colors text-white"
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Colonne dinamiche: Piattaforma e Info */}
          {menuColumns.map(col => (
            <div key={col.title}>
              <h4 className="text-white font-bold mb-4 tracking-wide text-sm">{col.title}</h4>
              <ul className="flex flex-col gap-3">
                {col.links.map(link => (
                  <li key={link.text}>
                    {link.isInternal ? (
                      <Link 
                        to={link.to} 
                        onClick={handleScrollTop}
                        className="text-white/40 hover:text-[#D4835E] text-sm transition-colors"
                      >
                        {link.text}
                      </Link>
                    ) : (
                      <a 
                        href={link.to} 
                        className="text-white/40 hover:text-[#D4835E] text-sm transition-colors"
                      >
                        {link.text}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

        </div>

        {/* Barra inferiore */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-white/30 text-xs">© 2026 RoomDate MVP. Tutti i diritti riservati.</span>
          <div className="flex gap-4">
            {bottomLinks.map(link => (
              <React.Fragment key={link.text}>
                {link.isInternal ? (
                  <Link 
                    to={link.to} 
                    onClick={handleScrollTop}
                    className="text-white/40 hover:text-[#D4835E] text-xs transition-colors"
                  >
                    {link.text}
                  </Link>
                ) : (
                  <a 
                    href={link.to} 
                    className="text-white/40 hover:text-[#D4835E] text-xs transition-colors"
                  >
                    {link.text}
                  </a>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;