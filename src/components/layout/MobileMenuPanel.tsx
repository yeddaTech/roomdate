import type { ReactNode, RefObject } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, FileText, LogIn, LogOut, Settings, Shield, ShieldCheck, User, UserPlus } from 'lucide-react';
import type { SessionUser } from '../../api/types';
import { buttonClasses } from '../ui/buttonClasses';
import { cn, focusRing } from '../ui/cn';
import { Sheet, SheetContent } from '../ui/Sheet';

// Pannello del menu sul telefono. Sta in un file a parte, caricato quando serve: il codice della
// finestra (Radix Dialog) non pesa sul primo caricamento della pagina.

function SheetLink({ to, icon, children, onNavigate }: { to: string; icon: ReactNode; children: string; onNavigate: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => cn(
        'flex h-12 items-center gap-3 rounded-control px-3 text-base font-bold [&_svg]:size-5 [&_svg]:text-foreground-muted',
        isActive ? 'bg-surface-muted text-foreground' : 'text-foreground hover:bg-surface-muted',
        focusRing,
      )}
    >
      {icon}
      {children}
    </NavLink>
  );
}

interface MobileMenuPanelProps {
  user: SessionUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
  /** Il pulsante che apre il menu: chiudendolo il focus torna lì. */
  trigger: RefObject<HTMLButtonElement | null>;
}

export default function MobileMenuPanel({ user, open, onOpenChange, onSignOut, trigger }: MobileMenuPanelProps) {
  const go = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={user ? `Ciao, ${user.firstName}` : 'Menu'}
        description={user ? user.email : undefined}
        // Il focus torna al pulsante, a meno che cambiando pagina non sia già andato sul contenuto
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (!document.activeElement || document.activeElement === document.body) trigger.current?.focus();
        }}
      >
        <nav aria-label="Menu" className="flex flex-col gap-1">
          {user ? (
            <>
              <SheetLink to="/dashboard" icon={<User />} onNavigate={go}>Il mio profilo</SheetLink>
              <SheetLink to="/impostazioni" icon={<Settings />} onNavigate={go}>Impostazioni</SheetLink>
              {user.isAdmin && <SheetLink to="/moderazione" icon={<ShieldCheck />} onNavigate={go}>Moderazione</SheetLink>}
            </>
          ) : (
            <>
              <SheetLink to="/accedi" icon={<LogIn />} onNavigate={go}>Accedi</SheetLink>
              <SheetLink to="/registrati" icon={<UserPlus />} onNavigate={go}>Registrati</SheetLink>
            </>
          )}
          <div className="my-2 h-px bg-line" />
          <SheetLink to="/guida" icon={<BookOpen />} onNavigate={go}>Come funziona</SheetLink>
          <SheetLink to="/privacy" icon={<Shield />} onNavigate={go}>Privacy</SheetLink>
          <SheetLink to="/termini" icon={<FileText />} onNavigate={go}>Termini di servizio</SheetLink>
        </nav>
        {user && (
          <button type="button" onClick={onSignOut} className={buttonClasses({ variant: 'secondary', className: 'mt-auto w-full' })}>
            <LogOut /> Esci
          </button>
        )}
      </SheetContent>
    </Sheet>
  );
}
