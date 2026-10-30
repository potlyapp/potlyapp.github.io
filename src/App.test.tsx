import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { fa } from './i18n/fa';

describe('App shell', () => {
  beforeEach(() => {
    window.location.hash = '#/';
  });

  it('renders the Today page with navigation', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: fa.today.title })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: fa.nav.primary })).toBeInTheDocument();
  });

  it('navigates to the plants page', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('link', { name: fa.nav.plants }));
    expect(screen.getByRole('heading', { name: fa.plants.title })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes', () => {
    window.location.hash = '#/nope';
    render(<App />);
    expect(screen.getByRole('heading', { name: fa.notFound.title })).toBeInTheDocument();
  });
});
