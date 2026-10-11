import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Heart, Menu, MessageCircle, Search } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useUnreadCount } from '../../api/hooks';
import { buttonClasses } from '../ui/buttonClasses';
import { cn, focusRing } from '../ui/cn';
import { useLazyComponent } from '../ui/useLazyComponent';
import AccountMenu from './AccountMenu';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { unreadLabel } from './unread';

// Il pannello del telefono (Radix Dialog) ha il codice a parte: non serve per aprire la pagina
const importMobileMenu = () => import('./MobileMenuPanel');

// L'unica barra di navigazione del sito (prima ce n'erano nove, copiate pagina per pagina con
// link diversi). Su desktop: link principali e menu dell'account; sul telefono la navigazione
// principale sta nella barra in basso e qui resta un menu con il resto.

function HeaderLink({ to, icon, children, badge = 0 }: { to: string; icon: ReactNode; children: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        'relative inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors duration-150 [&_svg]:size-4',
        isActive ? 'bg-surface-muted text-foreground' : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
        focusRing,
      )}
    >
      {icon}
      {children}
      {badge > 0 && (
        <>
          <span aria-hidden="true" className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 text-primary-foreground">
            {badge > 99 ? '99+' : badge}
          </span>
          <span className="sr-only">, {unreadLabel(badge)}</span>
        </>
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
  const { Component: MobileMenuPanel, load: loadMobileMenu } = useLazyComponent(importMobileMenu);

  // Cambiando pagina il menu del telefono si chiude da solo
  useEffect(() => setMenuOpen(false), [pathname]);

  const openMobileMenu = () => {
    setMenuOpen(true);
    loadMobileMenu();
  };

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
          {user && <HeaderLink to="/preferiti" icon={<Heart />}>Preferiti</HeaderLink>}
          <HeaderLink to="/chat" icon={<MessageCircle />} badge={unread}>Chat</HeaderLink>
          <HeaderLink to="/guida" icon={<BookOpen />}>Come funziona</HeaderLink>
        </nav>

        <div className="ml-auto flex items-center gap-1 md:ml-0 md:gap-2">
          <ThemeToggle />
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
        </div>
        {MobileMenuPanel && (
          <MobileMenuPanel user={user} open={menuOpen} onOpenChange={setMenuOpen} onSignOut={signOut} trigger={menuButton} />
        )}
      </div>
    </header>
  );
}
