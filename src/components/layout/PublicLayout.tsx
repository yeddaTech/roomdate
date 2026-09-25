import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import PageLoader from '../PageLoader';
import MobileTabBar, { tabBarPadding } from './MobileTabBar';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';
import SkipLink from './SkipLink';

/** Pagine pubbliche e informative: navigazione, contenuto, piè di pagina e barra del telefono. */
export default function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SkipLink />
      <SiteHeader />
      <main id="contenuto" tabIndex={-1} className="flex-1 outline-none">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      {/* Sul telefono la barra in basso copre l'ultima parte della pagina: il piè di pagina le lascia spazio */}
      <SiteFooter className={tabBarPadding} />
      <MobileTabBar />
    </div>
  );
}
