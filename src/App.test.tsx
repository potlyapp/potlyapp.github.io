import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { fa } from './i18n/fa';

describe('App shell', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('renders the Today page with navigation', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: fa.today.title })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: fa.nav.primary })).toBeInTheDocument();
  });

  it('navigates to the plants page using a root path', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('link', { name: fa.nav.plants }));
    expect(screen.getByRole('heading', { name: fa.plants.title })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/plants');
    expect(window.location.hash).toBe('');
  });

  it('opens a deep link directly on load (simulates 404.html fallback)', () => {
    window.history.pushState({}, '', '/settings');
    render(<App />);
    expect(screen.getByRole('heading', { name: fa.settings.title })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes', () => {
    window.history.pushState({}, '', '/nope');
    render(<App />);
    expect(screen.getByRole('heading', { name: fa.notFound.title })).toBeInTheDocument();
  });
});
