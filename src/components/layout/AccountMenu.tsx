import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, ShieldCheck, User } from 'lucide-react';
import type { SessionUser } from '../../api/types';
import Avatar from '../ui/Avatar';
import { cn, focusRing } from '../ui/cn';

// Menu dell'account su desktop, come "disclosure" (pulsante con aria-expanded che mostra un elenco
// di link): è lo schema indicato per i menu di navigazione, al posto di role="menu" che i lettori
// di schermo trattano come il menu di un programma. Esc lo chiude e riporta il focus sul
// pulsante; si chiude anche cliccando fuori, uscendone con Tab o cambiando pagina.

const itemClasses = cn(
  'flex w-full items-center gap-2.5 rounded-[0.625rem] px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-surface-muted [&_svg]:size-4 [&_svg]:text-foreground-muted',
  focusRing, 'focus-visible:ring-offset-0',
);

function MenuLink({ to, icon, children }: { to: string; icon: ReactNode; children: string }) {
  return (
    <li>
      <Link to={to} className={itemClasses}>{icon}{children}</Link>
    </li>
  );
}

export default function AccountMenu({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      // Uscendo dal menu con Tab si chiude (relatedTarget è null per i clic, gestiti sopra)
      onBlur={(e) => { if (e.relatedTarget && !rootRef.current?.contains(e.relatedTarget)) setOpen(false); }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn('inline-flex h-11 items-center gap-2 rounded-full pl-1 pr-3 text-sm font-bold text-foreground hover:bg-surface-muted', focusRing)}
      >
        <Avatar name={user.firstName} size="sm" decorative />
        <span>{user.firstName}</span>
        <ChevronDown className={cn('size-4 text-foreground-muted transition-transform duration-150', open && 'rotate-180')} aria-hidden="true" />
        <span className="sr-only">, menu dell&apos;account</span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-[1500] mt-2 w-64 rounded-control border border-line bg-surface p-1.5 text-foreground shadow-overlay animate-fade-in"
      >
        <p className="px-3 py-2 text-sm">
          <span className="block font-bold">{user.firstName} {user.lastName}</span>
          <span className="block truncate text-foreground-muted">{user.email}</span>
        </p>
        <div className="my-1.5 h-px bg-line" />
        <ul>
          <MenuLink to="/dashboard" icon={<User />}>Il mio profilo</MenuLink>
          <MenuLink to="/impostazioni" icon={<Settings />}>Impostazioni</MenuLink>
          {user.isAdmin && <MenuLink to="/moderazione" icon={<ShieldCheck />}>Moderazione</MenuLink>}
        </ul>
        <div className="my-1.5 h-px bg-line" />
        <button type="button" onClick={onSignOut} className={itemClasses}><LogOut /> Esci</button>
      </div>
    </div>
  );
}
