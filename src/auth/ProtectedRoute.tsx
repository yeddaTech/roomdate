import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PageLoader from '../components/PageLoader';
import { useAuth } from './AuthContext';

/** Mostra la pagina solo a chi ha una sessione valida; gli altri vanno all'accesso e poi tornano qui. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader />;

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center font-sans">
        <p className="text-neutral-600 font-medium">Impossibile verificare l'accesso. Controlla la connessione.</p>
        <button
          onClick={retry}
          className="bg-neutral-900 hover:bg-neutral-800 text-white px-8 py-3 rounded-full font-bold shadow-md transition-all cursor-pointer"
        >
          Riprova
        </button>
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/accedi" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}
