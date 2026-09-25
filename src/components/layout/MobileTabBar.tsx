import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, LogIn, MessageCircle, Search, User } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useUnreadCount } from '../../api/hooks';
import { cn, focusRing } from '../ui/cn';
import { unreadLabel } from './unread';

// Barra in basso sul telefono, come in un'app: le quattro destinazioni principali sempre a portata
// di pollice, con il margine di sicurezza dell'iPhone sotto.

function TabLink({ to, icon, label, end = false, badge = 0 }: { to: string; icon: ReactNode; label: string; end?: boolean; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={badge > 0 ? `${label}, ${unreadLabel(badge)}` : undefined}
      className={({ isActive }) => cn(
        'relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold transition-colors duration-150 [&_svg]:size-6',
        isActive ? 'text-primary' : 'text-foreground-muted',
        focusRing, 'focus-visible:ring-offset-0',
      )}
    >
      <span className="relative">
        {icon}
        {badge > 0 && (
          <span aria-hidden="true" className="absolute -right-2.5 -top-1.5 min-w-5 rounded-full border-2 border-surface bg-primary px-1 text-center text-[11px] leading-4 text-primary-foreground">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      {label}
    </NavLink>
  );
}

export default function MobileTabBar() {
  const { user } = useAuth();
  const unread = useUnreadCount({ enabled: Boolean(user) }).data ?? 0;
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4 px-[env(safe-area-inset-left)]">
        <li><TabLink to="/" end icon={<Home />} label="Home" /></li>
        <li><TabLink to="/ricerca" icon={<Search />} label="Cerca" /></li>
        <li><TabLink to="/chat" icon={<MessageCircle />} label="Chat" badge={unread} /></li>
        <li>
          {user
            ? <TabLink to="/dashboard" icon={<User />} label="Profilo" />
            : <TabLink to="/accedi" icon={<LogIn />} label="Accedi" />}
        </li>
      </ul>
    </nav>
  );
}

/** Spazio da lasciare sotto il contenuto perché la barra non lo copra. */
export const tabBarPadding = 'pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0';
