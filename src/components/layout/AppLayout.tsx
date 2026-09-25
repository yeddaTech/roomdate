import { Suspense, useState } from 'react';
import { Outlet, useMatches } from 'react-router-dom';
import { ProtectedRoute } from '../../auth/ProtectedRoute';
import PageLoader from '../PageLoader';
import { cn } from '../ui/cn';
import { TabBarContext, type RouteHandle } from './layoutContext';
import MobileTabBar, { tabBarPadding } from './MobileTabBar';
import SiteHeader from './SiteHeader';
import SkipLink from './SkipLink';

/**
 * Area personale (profilo, chat, impostazioni, moderazione): solo con una sessione valida, senza
 * piè di pagina. Una pagina a tutta altezza (la chat) riempie lo schermo e scorre al suo interno.
 */
export default function AppLayout() {
  const fullHeight = useMatches().some((m) => (m.handle as RouteHandle | undefined)?.fullHeight);
  const [tabBarHidden, setTabBarHidden] = useState(false);

  return (
    <TabBarContext.Provider value={setTabBarHidden}>
      <div className={cn('flex flex-col bg-background', fullHeight ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
        <SkipLink />
        <SiteHeader />
        <main id="contenuto" tabIndex={-1} className={cn('flex-1 outline-none', fullHeight && 'min-h-0', !tabBarHidden && tabBarPadding)}>
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ProtectedRoute>
        </main>
        {!tabBarHidden && <MobileTabBar />}
      </div>
    </TabBarContext.Provider>
  );
}
