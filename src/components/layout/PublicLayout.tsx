import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import PageLoader from '../PageLoader';
import { TabBarContext } from './layoutContext';
import MobileTabBar, { tabBarPadding } from './MobileTabBar';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';
import SkipLink from './SkipLink';

/**
 * Pagine pubbliche e informative: navigazione, contenuto, piè di pagina e barra del telefono. Una
 * pagina può nascondere la barra in basso (il dettaglio di un annuncio ci mette il pulsante "Contatta").
 */
export default function PublicLayout() {
  const [tabBarHidden, setTabBarHidden] = useState(false);
  return (
    <TabBarContext.Provider value={setTabBarHidden}>
      <div className="flex min-h-dvh flex-col bg-background">
        <SkipLink />
        <SiteHeader />
        <main id="contenuto" tabIndex={-1} className="flex-1 outline-none">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
        {/* Sul telefono la barra in basso (o quella di una pagina) copre l'ultima parte: il piè di pagina le lascia spazio */}
        <SiteFooter className={tabBarPadding} />
        {!tabBarHidden && <MobileTabBar />}
      </div>
    </TabBarContext.Provider>
  );
}
