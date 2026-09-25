import { Link } from 'react-router-dom';
import { cn } from '../ui/cn';
import Logo from './Logo';

// Piè di pagina delle pagine pubbliche: scuro in entrambi i temi, per chiudere la pagina.
const linkClass = 'rounded-sm text-sm text-stone-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400';

export default function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('bg-stone-900 text-stone-300', className)}>
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo onDark />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">
            Stanze in affitto e coinquilini, con contatto diretto tra utenti e chat cifrata end-to-end.
          </p>
        </div>
        <nav aria-label="Esplora">
          <h2 className="mb-4 text-sm font-bold text-white">Esplora</h2>
          <ul className="flex flex-col gap-3">
            <li><Link to="/ricerca?intent=stanza" className={linkClass}>Stanze disponibili</Link></li>
            <li><Link to="/ricerca?intent=coinquilino" className={linkClass}>Cerca coinquilini</Link></li>
            <li><Link to="/guida" className={linkClass}>Come funziona</Link></li>
          </ul>
        </nav>
        <nav aria-label="Informazioni legali">
          <h2 className="mb-4 text-sm font-bold text-white">Legale</h2>
          <ul className="flex flex-col gap-3">
            <li><Link to="/privacy" className={linkClass}>Privacy e sicurezza</Link></li>
            <li><Link to="/termini" className={linkClass}>Termini di servizio</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-stone-800">
        <p className="mx-auto max-w-7xl px-6 py-6 text-sm text-stone-400">© {new Date().getFullYear()} RoomDate</p>
      </div>
    </footer>
  );
}
