import React, { useState, useEffect } from 'react';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      style={{
        backgroundColor: scrolled ? 'rgba(254,250,244,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        boxShadow: scrolled ? '0 1px 20px rgba(122,75,42,0.1)' : 'none',
        transition: 'all 0.3s ease',
      }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex justify-between items-center h-18 py-4">

          {/* Logo */}
          <a href="#" className="flex items-center gap-2">
            <div
              style={{ background: 'var(--terra)', width: 32, height: 32, borderRadius: 8 }}
              className="flex items-center justify-center"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" fill="white" opacity="0.9"/>
                <path d="M9 22V12h6v10" fill="white" opacity="0.6"/>
              </svg>
            </div>
            <span className="font-display text-2xl font-bold" style={{ color: 'var(--warm-dark)' }}>
              Room<span style={{ color: 'var(--terra)' }}>Date</span>
            </span>
          </a>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#" className="nav-link">Home</a>
            <a href="#" className="nav-link">Trova Stanza</a>
            <a href="#" className="nav-link">Cerca Coinquilini</a>
            <a href="#" className="nav-link">Come Funziona</a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button className="btn-outline" style={{ padding: '0.55rem 1.5rem', fontSize: '0.88rem' }}>
              Accedi
            </button>
            <button className="btn-primary" style={{ padding: '0.55rem 1.5rem', fontSize: '0.88rem' }}>
              Registrati Gratis
            </button>
          </div>

          {/* Hamburger */}
          <button
            className="md:hidden"
            style={{ color: 'var(--warm-brown)' }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Chiudi menu" : "Apri menu di navigazione"} // <-- LA CORREZIONE È QUI
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
              }
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div
            style={{ background: 'var(--cream)', borderTop: '1px solid var(--sand)' }}
            className="md:hidden py-4 px-2 space-y-3"
          >
            {['Home', 'Trova Stanza', 'Cerca Coinquilini', 'Come Funziona'].map(item => (
              <a key={item} href="#" className="block py-2 px-3 nav-link text-base">{item}</a>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <button className="btn-outline w-full">Accedi</button>
              <button className="btn-primary w-full">Registrati Gratis</button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;