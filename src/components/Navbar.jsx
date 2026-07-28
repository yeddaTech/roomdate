import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const sanitizeHTML = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '');
};

const Navbar = ({ user, handleLogout }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // 1. Array unico con le 5 opzioni della Navbar
  const navLinks = [
    { name: 'Home', path: '/', icon: '🏠' },
    { name: 'Trova Stanza', path: '/ricerca', icon: '🔍' },
    { name: 'Chat', path: '/chat', icon: '💬' },
    { name: 'Profilo', path: '/dashboard', icon: '👤' },
    { name: 'Impostazioni', path: '/impostazioni', icon: '⚙️' },
  ];

  // Gestione ottimizzata dello scroll per il design glassmorphism
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

  // Blocco dello scroll su mobile quando il menu è aperto
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [menuOpen]);

  const chiudiMenu = () => setMenuOpen(false);

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-300 ${scrolled ? 'pt-4' : 'pt-6'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className={`flex justify-between items-center px-6 py-3 rounded-full transition-all duration-300 ${
            scrolled 
              ? 'bg-white/90 backdrop-blur-lg shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/50' 
              : 'bg-white/70 backdrop-blur-md border border-transparent shadow-sm'
          }`}>
            
            {/* LOGO */}
            <Link to="/" onClick={chiudiMenu} className="flex items-center gap-2 group" aria-label="Torna alla Home">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform">
                <span className="font-bold text-xl" aria-hidden="true">R</span>
              </div>
              <span className="font-display text-2xl font-extrabold tracking-tight text-neutral-800">
                Room<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">Date</span>
              </span>
            </Link>

            {/* Menu Desktop (Dinamico a 5 opzioni con indicatore attivo) */}
            <div className="hidden md:flex items-center gap-6 bg-neutral-50/50 px-6 py-2 rounded-full border border-neutral-100 shadow-inner">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`text-sm font-semibold transition-colors ${
                      isActive ? 'text-orange-500' : 'text-neutral-600 hover:text-orange-500'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>

            {/* CTA Desktop */}
            <div className="hidden md:flex items-center gap-4">
              {user && user.nome ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-neutral-600">Ciao, <strong className="text-neutral-900">{sanitizeHTML(user.nome)}</strong></span>
                  <button onClick={handleLogout} className="px-5 py-2.5 rounded-full text-sm font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-all">Esci</button>
                </div>
              ) : (
                <>
                  <Link to="/accedi" className="text-sm font-bold text-neutral-700 hover:text-orange-500 transition-colors">Accedi</Link>
                  <Link to="/registrati" className="px-5 py-2.5 rounded-full text-sm font-bold text-white bg-neutral-900 hover:bg-neutral-800 hover:scale-105 transition-all shadow-md">
                    Registrati
                  </Link>
                </>
              )}
            </div>

            {/* Hamburger Mobile */}
            <button 
              className="md:hidden p-2 rounded-full hover:bg-neutral-100 transition-colors z-[1002]" 
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Apri menu"
            >
              <div className="w-6 flex flex-col gap-1.5 pointer-events-none">
                <span className={`block h-0.5 bg-neutral-900 transition-all duration-300 origin-center ${menuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                <span className={`block h-0.5 bg-neutral-900 transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`}></span>
                <span className={`block h-0.5 bg-neutral-900 transition-all duration-300 origin-center ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* OVERLAY E MENU MOBILE UNIFICATI (Dinamico a 5 opzioni) */}
      <div className={`fixed inset-y-0 right-0 w-72 bg-white shadow-2xl z-[1001] p-8 pt-28 transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col gap-6 text-lg font-bold text-neutral-700">
          {user && user.nome && (
             <div className="border-b border-neutral-100 pb-6 mb-2">
               <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">Accesso effettuato</p>
               <h3 className="text-2xl text-neutral-900 truncate">{sanitizeHTML(user.nome)}</h3>
             </div>
          )}
          
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link 
                key={link.path}
                to={link.path} 
                onClick={chiudiMenu} 
                className={`transition-colors flex items-center gap-3 ${
                  isActive ? 'text-orange-500' : 'hover:text-orange-500'
                }`}
              >
                <span className="text-2xl" aria-hidden="true">{link.icon}</span> {link.name}
              </Link>
            );
          })}
          
          <div className="mt-auto pt-8 border-t border-neutral-100">
            {user ? (
              <button onClick={() => { handleLogout(); chiudiMenu(); }} className="w-full bg-neutral-100 text-neutral-900 py-4 rounded-2xl font-bold hover:bg-neutral-200 transition-all">Esci dall'account</button>
            ) : (
              <div className="flex flex-col gap-3">
                <Link to="/accedi" onClick={chiudiMenu} className="w-full border border-neutral-200 text-neutral-900 text-center py-4 rounded-2xl font-bold">Accedi</Link>
                <Link to="/registrati" onClick={chiudiMenu} className="w-full bg-neutral-900 text-white text-center py-4 rounded-2xl font-bold shadow-lg">Registrati Gratis</Link>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Sfondo scuro Mobile */}
      {menuOpen && (
        <div 
          className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-[1000] md:hidden animate-in fade-in duration-300" 
          onClick={chiudiMenu}
        ></div>
      )}
    </>
  );
};

export default Navbar;