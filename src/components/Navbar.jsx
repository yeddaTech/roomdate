import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Navbar = ({ user, handleLogout }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const onLogout = (e) => {
    e.preventDefault();
    if (typeof handleLogout === 'function') {
      handleLogout();
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'pt-4' : 'pt-6'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className={`flex justify-between items-center px-6 py-3 rounded-full transition-all duration-300 ${
          scrolled 
            ? 'bg-white/80 backdrop-blur-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50' 
            : 'bg-transparent'
        }`}>
          
          <Link to="/" className="flex items-center gap-2 group" aria-label="Torna alla Home">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform">
              <span className="font-bold text-xl" aria-hidden="true">R</span>
            </div>
            <span className="font-display text-2xl font-extrabold tracking-tight text-neutral-800">
              Room<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">Date</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 bg-white/40 px-6 py-2 rounded-full border border-white/60 shadow-sm backdrop-blur-md">
            <Link to="/" className="text-sm font-medium text-neutral-600 hover:text-orange-500 transition-colors">Home</Link>
            <Link to="/ricerca" className="text-sm font-medium text-neutral-600 hover:text-orange-500 transition-colors">Trova Stanza</Link>
            <Link to="/chat" className="text-sm font-medium text-neutral-600 hover:text-orange-500 transition-colors">Chat</Link>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {user && user.nome ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-neutral-700">Ciao, {String(user.nome).replace(/[<>]/g, '')}</span>
                <button 
                  onClick={onLogout} 
                  className="px-5 py-2.5 rounded-full text-sm font-semibold text-neutral-600 bg-white hover:bg-neutral-50 shadow-sm border border-neutral-100 transition-all"
                  aria-label="Esci dal profilo"
                >
                  Esci
                </button>
              </div>
            ) : (
              <>
                <Link to="/accedi" className="text-sm font-semibold text-neutral-700 hover:text-orange-500 transition-colors">Accedi</Link>
                <Link to="/registrati" className="px-5 py-2.5 rounded-full text-sm font-bold text-white bg-neutral-900 hover:bg-neutral-800 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                  Registrati Gratis
                </Link>
              </>
            )}
          </div>

          <button 
            className="md:hidden p-2" 
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Chiudi menu" : "Apri menu di navigazione"}
          >
            <div className="w-6 flex flex-col gap-1.5" aria-hidden="true">
              <span className={`block h-0.5 bg-neutral-800 transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
              <span className={`block h-0.5 bg-neutral-800 transition-all ${menuOpen ? 'opacity-0' : ''}`}></span>
              <span className={`block h-0.5 bg-neutral-800 transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
            </div>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;