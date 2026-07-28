import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const handleScrollTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  };

  return (
    <footer className="bg-neutral-900 pt-20 pb-10 px-6 border-t border-neutral-800">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          
          <div className="col-span-1 md:col-span-2">
            <Link to="/" onClick={handleScrollTop} className="inline-block mb-6" aria-label="Torna alla Home">
              <span className="font-display text-2xl font-extrabold tracking-tight text-white">
                Room<span className="text-orange-500">Date</span>
              </span>
            </Link>
            <p className="text-neutral-400 text-sm leading-relaxed max-w-sm mb-8">
              Il modo più trasparente, veloce e sicuro per trovare stanze e coinquilini in Italia, direttamente dal tuo smartphone.
            </p>
            <div className="flex gap-3">
              {['Facebook', 'Instagram', 'Twitter'].map((social, i) => (
                <a 
                  key={i} 
                  href={`https://${social.toLowerCase()}.com`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-orange-500 hover:-translate-y-1 flex items-center justify-center transition-all text-white shadow-sm"
                  aria-label={`Visita la nostra pagina ${social}`}
                >
                  <span className="text-xs" aria-hidden="true">{social[0]}</span>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 tracking-wide text-sm">Esplora</h4>
            <ul className="flex flex-col gap-4">
              <li><Link to="/ricerca" className="text-neutral-400 hover:text-white transition-colors text-sm">Stanze disponibili</Link></li>
              <li><Link to="/ricerca?intent=coinquilino" className="text-neutral-400 hover:text-white transition-colors text-sm">Cerca coinquilini</Link></li>
              <li><Link to="/dashboard" className="text-neutral-400 hover:text-white transition-colors text-sm">Il tuo profilo</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 tracking-wide text-sm">Supporto</h4>
            <ul className="flex flex-col gap-4">
              <li><Link to="/guida" className="text-neutral-400 hover:text-white transition-colors text-sm">Come funziona</Link></li>
              <li><Link to="/privacy" className="text-neutral-400 hover:text-white transition-colors text-sm">Privacy & Sicurezza</Link></li>
              <li><a href="mailto:support@roomdate.com" className="text-neutral-400 hover:text-white transition-colors text-sm">Contattaci</a></li>
            </ul>
          </div>

        </div>

        <div className="border-t border-neutral-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-neutral-500 text-sm font-medium">&copy; {new Date().getFullYear()} RoomDate. Tutti i diritti riservati.</span>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-neutral-500 hover:text-white text-sm transition-colors">Privacy Policy</Link>
            <Link to="/termini" className="text-neutral-500 hover:text-white text-sm transition-colors">Termini di Servizio</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;