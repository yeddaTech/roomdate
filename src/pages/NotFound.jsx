import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col justify-center items-center font-sans p-6 text-center">
      <Helmet>
        <title>Pagina non trovata | RoomDate</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="text-6xl mb-4 opacity-50">🧭</div>
      <h1 className="font-serif text-3xl font-extrabold text-neutral-900 mb-4 tracking-tight">Pagina non trovata</h1>
      <p className="text-neutral-500 mb-8 font-medium">L&apos;indirizzo che hai aperto non esiste o non è più disponibile.</p>
      <button onClick={() => navigate('/')} className="bg-neutral-900 hover:bg-neutral-800 text-white px-8 py-3.5 rounded-full font-bold shadow-md transition-all cursor-pointer">
        Torna alla Home
      </button>
    </div>
  );
}
