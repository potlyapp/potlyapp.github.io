import { BrowserRouter, NavLink, Route, Routes, Link } from 'react-router-dom';
import { fa } from './i18n/fa';
import { EditPlantPage } from './features/plants/EditPlantPage';
import { PlantDetailPage } from './features/plants/PlantDetailPage';
import { PlantsPage } from './features/plants/PlantsPage';
import { QuickAddPage } from './features/plants/QuickAddPage';
import { SchedulePage } from './features/plants/SchedulePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TodayPage } from './features/today/TodayPage';
import { UndoProvider } from './ui/UndoProvider';

function NotFound() {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{fa.notFound.title}</h1>
      <Link to="/">{fa.notFound.back}</Link>
    </section>
  );
}

export function AppRoutes() {
  return (
    <UndoProvider>
    <div className="app">
      <header className="app-header">
        <span className="app-name">{fa.appName}</span>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/plants" element={<PlantsPage />} />
          <Route path="/p/:id" element={<PlantDetailPage />} />
          <Route path="/plants/new" element={<QuickAddPage />} />
          <Route path="/plants/:id/edit" element={<EditPlantPage />} />
          <Route path="/p/:id/schedule" element={<SchedulePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
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
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AppRoutes />
    </BrowserRouter>
  );
}
