import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Appena la pagina carica, controlliamo se c'è un utente salvato
    const savedUser = localStorage.getItem('roomdate_user');
    
    if (!savedUser) {
      // Se non c'è, è un intruso! Lo cacciamo alla pagina di login
      navigate('/accedi');
    } else {
      // Altrimenti carichiamo i suoi dati
      setUser(JSON.parse(savedUser));
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('roomdate_user');
    navigate('/accedi');
  };

  // Finché non carica l'utente, mostriamo bianco
  if (!user) return null; 

  return (
    <div style={{ backgroundColor: '#FEFAF4', minHeight: '100vh', padding: '2rem', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '3rem', borderRadius: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.5rem', color: '#2C1A0E', marginBottom: '1rem' }}>
          Benvenuto, {user.nome}! 👋
        </h1>
        <p style={{ color: '#8A7B6E', marginBottom: '2rem' }}>
          Questa è la tua area riservata. La tua email registrata è: <strong>{user.email}</strong>
        </p>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link to="/" style={{ padding: '0.8rem 1.5rem', background: '#F5E3CC', color: '#7A4B2A', textDecoration: 'none', borderRadius: '0.5rem', fontWeight: '600' }}>
            Torna alla Home
          </Link>
          <button onClick={handleLogout} style={{ padding: '0.8rem 1.5rem', background: '#E24B4A', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer' }}>
            Esci (Logout)
          </button>
        </div>
      </div>
    </div>
  );
}