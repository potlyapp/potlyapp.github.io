import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { fa } from '../i18n/fa';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('corrupt record');
  return <p>fine</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeInTheDocument();
  });

  it('shows an alert with retry instead of a white screen, and moves focus to it', () => {
    render(
      <ErrorBoundary>
        <Bomb explode />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(fa.errorBoundary.title);
    expect(screen.getByRole('heading', { name: fa.errorBoundary.title })).toHaveFocus();
    expect(screen.getByRole('link', { name: fa.errorBoundary.home })).toHaveAttribute('href', '/');
  });

  it('retry re-renders the children', async () => {
    function Harness() {
      const [explode, setExplode] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setExplode(false)}>
            heal
          </button>
          <ErrorBoundary>
            <Bomb explode={explode} />
          </ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'heal' }));
    await userEvent.click(screen.getByRole('button', { name: fa.errorBoundary.retry }));
    expect(screen.getByText('fine')).toBeInTheDocument();
  });

  it('root level offers a reload, not retry', () => {
    render(
      <ErrorBoundary level="root">
        <Bomb explode />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: fa.errorBoundary.reload })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: fa.errorBoundary.retry })).not.toBeInTheDocument();
  });

  it('a boundary keyed by route resets on navigation while the shell survives', async () => {
    function Shell() {
      return (
        <MemoryRouter initialEntries={['/bad']}>
          <nav>
            <Link to="/good">go-good</Link>
          </nav>
          <Routes>
            <Route path="/bad" element={<ErrorBoundary key="bad"><Bomb explode /></ErrorBoundary>} />
            <Route path="/good" element={<ErrorBoundary key="good"><Bomb explode={false} /></ErrorBoundary>} />
          </Routes>
        </MemoryRouter>
      );
    }
    render(<Shell />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'go-good' }));
    expect(screen.getByText('fine')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
