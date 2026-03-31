import React from 'react';
import Navbar from './components/Navbar';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Richiamiamo la Navbar appena creata */}
      <Navbar />

      {/* Qui sotto andremo ad aggiungere il resto della pagina in futuro */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-800 text-center mt-10">
          Benvenuto su RoomDate!
        </h1>
        <p className="text-center text-gray-600 mt-4 text-lg">
          La tua nuova Navbar è pronta e funzionante.
        </p>
      </main>
    </div>
  );
}

export default App;