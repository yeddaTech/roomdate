import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Menu, MessageCircle, Search } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useUnreadCount } from '../../api/hooks';
import { buttonClasses } from '../ui/buttonClasses';
import { cn, focusRing } from '../ui/cn';
import AccountMenu from './AccountMenu';
import Logo from './Logo';
import { unreadLabel } from './unread';

type MobileMenuPanelComponent = typeof import('./MobileMenuPanel').default;

// L'unica barra di navigazione del sito (prima ce n'erano nove, copiate pagina per pagina con
// link diversi). Su desktop: link principali e menu dell'account; sul telefono la navigazione
// principale sta nella barra in basso e qui resta un menu con il resto.

function HeaderLink({ to, icon, children, badge = 0 }: { to: string; icon: ReactNode; children: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      aria-label={badge > 0 ? `${children}, ${unreadLabel(badge)}` : undefined}
      className={({ isActive }) => cn(
        'relative inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors duration-150 [&_svg]:size-4',
        isActive ? 'bg-surface-muted text-foreground' : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
        focusRing,
      )}
    >
      {icon}
      {children}
      {badge > 0 && (
        <span aria-hidden="true" className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 text-primary-foreground">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
}

export default function SiteHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const unread = useUnreadCount({ enabled: Boolean(user) }).data ?? 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  // Il codice del pannello (Radix Dialog) si scarica appena il browser è libero, non con la pagina.
  // Niente React.lazy: con Suspense React 19 aspetta almeno 300 ms prima di mostrare il pannello
  const [MobileMenuPanel, setMobileMenuPanel] = useState<MobileMenuPanelComponent | null>(null);
  const [menuLoadError, setMenuLoadError] = useState<unknown>(null);
  const loadMobileMenu = useCallback(
    () => import('./MobileMenuPanel').then((m) => setMobileMenuPanel(() => m.default)),
    [],
  );

  // Cambiando pagina il menu del telefono si chiude da solo
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    const prefetch = () => { loadMobileMenu().catch(() => {}); }; // riprova al tocco
    // Safari non ha requestIdleCallback
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 2000);
    return () => clearTimeout(id);
  }, [loadMobileMenu]);

  const openMobileMenu = () => {
    setMenuOpen(true);
    if (!MobileMenuPanel) loadMobileMenu().catch(setMenuLoadError);
  };
  // Codice non più disponibile (sito aggiornato nel frattempo): la pagina d'errore propone di ricaricare
  if (menuLoadError) throw menuLoadError;

  const signOut = async () => {
    setMenuOpen(false);
    navigate('/', { replace: true });
    await logout();
  };

  return (
    <header className="sticky top-0 z-[1000] border-b border-line bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:px-6">
        <Logo />

        <nav aria-label="Navigazione principale" className="hidden items-center gap-1 md:flex">
          <HeaderLink to="/ricerca" icon={<Search />}>Cerca</HeaderLink>
          <HeaderLink to="/chat" icon={<MessageCircle />} badge={unread}>Chat</HeaderLink>
          <HeaderLink to="/guida" icon={<BookOpen />}>Come funziona</HeaderLink>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <AccountMenu user={user} onSignOut={signOut} />
          ) : (
            <>
              <Link to="/accedi" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>Accedi</Link>
              <Link to="/registrati" className={buttonClasses({ size: 'sm' })}>Registrati</Link>
            </>
          )}
        </div>

        <button
          ref={menuButton}
          type="button"
          aria-label="Apri il menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={openMobileMenu}
          className={cn('inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-surface-muted md:hidden', focusRing)}
        >
          <Menu className="size-6" />
        </button>
        {MobileMenuPanel && (
          <MobileMenuPanel user={user} open={menuOpen} onOpenChange={setMenuOpen} onSignOut={signOut} trigger={menuButton} />
        )}
      </div>
    </header>
  );
}
