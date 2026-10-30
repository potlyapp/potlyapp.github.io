import { HashRouter, NavLink, Route, Routes, Link } from 'react-router-dom';
import { fa } from './i18n/fa';

function Page({ title, children }: { title: string; children: string }) {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{title}</h1>
      <p>{children}</p>
    </section>
  );
}

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
    <div className="app">
      <header className="app-header">
        <span className="app-name">{fa.appName}</span>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Page title={fa.today.title}>{fa.today.comingSoon}</Page>} />
          <Route path="/plants" element={<Page title={fa.plants.title}>{fa.plants.comingSoon}</Page>} />
          <Route path="/settings" element={<Page title={fa.settings.title}>{fa.settings.comingSoon}</Page>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <nav className="app-nav" aria-label={fa.nav.primary}>
        <NavLink to="/" end>{fa.nav.today}</NavLink>
        <NavLink to="/plants">{fa.nav.plants}</NavLink>
        <NavLink to="/settings">{fa.nav.settings}</NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
