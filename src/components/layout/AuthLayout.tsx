import { Suspense } from 'react';
import { Link, Outlet, useMatches } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageLoader from '../PageLoader';
import { cn, focusRing } from '../ui/cn';
import type { RouteHandle } from './layoutContext';
import Logo from './Logo';
import SkipLink from './SkipLink';

/**
 * Accesso, registrazione e recupero: solo il marchio e una via d'uscita, niente che distragga dal
 * modulo. Il collegamento a destra ("Non hai un account?") lo sceglie la rotta.
 */
export default function AuthLayout() {
  const authSwitch = useMatches().map((m) => (m.handle as RouteHandle | undefined)?.authSwitch).find(Boolean);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <header className="border-b border-line bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-5">
            <Logo />
            <Link to="/" className={cn('hidden items-center gap-1.5 rounded-full text-sm font-bold text-foreground-muted hover:text-foreground sm:inline-flex', focusRing)}>
              <ArrowLeft className="size-4" aria-hidden="true" /> Torna al sito
            </Link>
          </div>
          {authSwitch && (
            <p className="text-sm text-foreground-muted">
              <span className="hidden sm:inline">{authSwitch.text} </span>
              <Link to={authSwitch.to} className={cn('rounded-sm font-bold text-primary hover:text-primary-hover', focusRing)}>{authSwitch.label}</Link>
            </p>
          )}
        </div>
      </header>
      <main id="contenuto" tabIndex={-1} className="flex flex-1 flex-col outline-none pb-[env(safe-area-inset-bottom)]">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
