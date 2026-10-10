import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Heart, House, Settings, User } from 'lucide-react';
import { useMyListings } from '../../api/hooks';
import { useAuth } from '../../auth/AuthContext';
import { cn, focusRing } from '../ui/cn';

function SectionLink({ to, icon, children, end = false }: { to: string; icon: ReactNode; children: string; end?: boolean }) {
  return (
    <li className="shrink-0">
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) => cn(
          'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors duration-150 [&_svg]:size-4 lg:flex lg:w-full',
          isActive ? 'bg-foreground text-background' : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
          focusRing,
        )}
      >
        {icon}
        {children}
      </NavLink>
    </li>
  );
}

/**
 * Area personale (modulo M2.7): profilo, annunci, preferiti e impostazioni, ognuno con il suo
 * indirizzo. Su desktop le sezioni sono in una colonna a sinistra, sul telefono in una fila che
 * scorre in orizzontale sopra la pagina.
 */
export default function AccountLayout() {
  const { user } = useAuth();
  // "I miei annunci" serve a chi affitta, e a chi ne ha pubblicati prima di cambiare ruolo
  const myListings = useMyListings({ enabled: Boolean(user) });
  const showListings = user?.userType === 'affitta' || (myListings.data?.length ?? 0) > 0;

  // Sul telefono la fila delle sezioni scorre: quella aperta deve essere in vista
  const nav = useRef<HTMLUListElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const list = nav.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = active.offsetLeft - list.clientWidth / 2 + active.offsetWidth / 2;
  }, [pathname, showListings]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-10 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-10">
      <nav aria-label="Area personale" className="-mx-4 mb-6 px-4 lg:sticky lg:top-24 lg:mx-0 lg:mb-0 lg:px-0">
        <ul ref={nav} className="relative flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          <SectionLink to="/profilo" icon={<User />}>Profilo</SectionLink>
          {showListings && <SectionLink to="/annunci" icon={<House />}>I miei annunci</SectionLink>}
          <SectionLink to="/preferiti" icon={<Heart />}>Preferiti</SectionLink>
          <SectionLink to="/impostazioni" icon={<Settings />}>Impostazioni</SectionLink>
        </ul>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
