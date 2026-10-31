import { lazy, Suspense, useEffect, useRef, type RefObject } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { fa } from './i18n/fa';
import { PwaBanner } from './pwa/PwaBanner';
import { useOnlineStatus } from './pwa/useOnlineStatus';
import { useReminders } from './pwa/useReminders';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { UndoProvider } from './ui/UndoProvider';

const TodayPage = lazy(() => import('./features/today/TodayPage').then((m) => ({ default: m.TodayPage })));
const PlantsPage = lazy(() => import('./features/plants/PlantsPage').then((m) => ({ default: m.PlantsPage })));
const PlantDetailPage = lazy(() => import('./features/plants/PlantDetailPage').then((m) => ({ default: m.PlantDetailPage })));
const QuickAddPage = lazy(() => import('./features/plants/QuickAddPage').then((m) => ({ default: m.QuickAddPage })));
const EditPlantPage = lazy(() => import('./features/plants/EditPlantPage').then((m) => ({ default: m.EditPlantPage })));
const SchedulePage = lazy(() => import('./features/plants/SchedulePage').then((m) => ({ default: m.SchedulePage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const LabelsPage = lazy(() => import('./features/labels/LabelsPage').then((m) => ({ default: m.LabelsPage })));

function NotFound() {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{fa.notFound.title}</h1>
      <Link to="/">{fa.notFound.back}</Link>
    </section>
  );
}

/** Moves focus to <main> after in-app navigation so keyboard and screen-reader users land on the new page. */
function useFocusMainOnNavigation(ref: RefObject<HTMLElement | null>, pathname: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.focus({ preventScroll: true });
    window.scrollTo?.(0, 0);
  }, [pathname, ref]);
}

export function AppRoutes() {
  useReminders();
  const online = useOnlineStatus();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useFocusMainOnNavigation(mainRef, pathname);
  return (
    <UndoProvider>
      <div className="app">
        <a className="skip-link" href="#main">{fa.nav.skipToContent}</a>
        <header className="app-header">
          <span className="app-name">{fa.appName}</span>
          {!online && <span className="offline-badge" title={fa.pwa.offlineHint}>{fa.pwa.offline}</span>}
        </header>
        <PwaBanner />
        <main id="main" className="app-main" tabIndex={-1} ref={mainRef}>
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<p role="status" className="muted">{fa.loading}</p>}>
              <Routes>
                <Route path="/" element={<TodayPage />} />
                <Route path="/plants" element={<PlantsPage />} />
                <Route path="/p/:id" element={<PlantDetailPage />} />
                <Route path="/plants/new" element={<QuickAddPage />} />
                <Route path="/plants/:id/edit" element={<EditPlantPage />} />
                <Route path="/p/:id/schedule" element={<SchedulePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/labels" element={<LabelsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        <nav className="app-nav" aria-label={fa.nav.primary}>
          <NavLink to="/" end>{fa.nav.today}</NavLink>
          <NavLink to="/plants">{fa.nav.plants}</NavLink>
          <NavLink to="/settings">{fa.nav.settings}</NavLink>
        </nav>
      </div>
    </UndoProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary level="root">
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
