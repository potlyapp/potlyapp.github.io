import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { plantsRepo } from '../../data/plants';
import { settingsRepo } from '../../data/settings';
import { fa } from '../../i18n/fa';

function go(path: string) {
  window.history.pushState({}, '', path);
}

describe('plant QR section', () => {
  it('shows a QR image and a URL containing only the origin and the id', async () => {
    const plant = await plantsRepo.create({ name: 'پتوس' });
    go(`/p/${plant.id}`);
    render(<App />);
    expect(await screen.findByRole('img', { name: fa.qr.alt('پتوس') })).toBeInTheDocument();
    const url = `${window.location.origin}/p/${plant.id}`;
    expect(screen.getByText(url)).toBeInTheDocument();
    expect(screen.getByText(fa.qr.localOnly)).toBeInTheDocument();
  });

  it('uses the configured base URL', async () => {
    await settingsRepo.update({ baseUrl: 'https://potlyapp.github.io' });
    const plant = await plantsRepo.create({ name: 'پتوس' });
    go(`/p/${plant.id}`);
    render(<App />);
    expect(await screen.findByText(`https://potlyapp.github.io/p/${plant.id}`)).toBeInTheDocument();
    expect(screen.getByText(fa.settings.warn.origin_mismatch)).toBeInTheDocument();
  });

  it('shows not-found with local-only guidance for an unknown id, never another plant', async () => {
    await plantsRepo.create({ name: 'گیاه دیگر' });
    go('/p/AAAAAAAAAAAAAAAAAAAAAA');
    render(<App />);
    expect(await screen.findByRole('heading', { name: fa.qr.notFoundTitle })).toBeInTheDocument();
    expect(screen.getByText(fa.qr.notFoundBody)).toBeInTheDocument();
    expect(screen.queryByText('گیاه دیگر')).not.toBeInTheDocument();
  });
});

describe('labels page', () => {
  it('renders one label per active plant and skips archived ones', async () => {
    await plantsRepo.create({ name: 'الف' });
    await plantsRepo.create({ name: 'ب' });
    const gone = await plantsRepo.create({ name: 'بایگانی' });
    await plantsRepo.archive(gone.id);
    go('/labels');
    render(<App />);
    const sheet = await screen.findByRole('list', { name: fa.labels.title });
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(2);
    expect(within(sheet).getByText('الف')).toBeInTheDocument();
    expect(within(sheet).queryByText('بایگانی')).not.toBeInTheDocument();
    expect(screen.getByText(fa.qr.localOnly)).toBeInTheDocument();
  });

  it('shows an empty state and disables printing with no plants', async () => {
    go('/labels');
    render(<App />);
    expect(await screen.findByText(fa.labels.empty)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: fa.labels.print })).toBeDisabled();
  });
});

describe('base URL setting', () => {
  beforeEach(() => go('/settings'));

  it('saves a normalised origin', async () => {
    render(<App />);
    await userEvent.type(await screen.findByLabelText(fa.settings.baseUrl), 'https://potlyapp.github.io/plants?x=1');
    await userEvent.click(screen.getByRole('button', { name: fa.settings.save }));
    expect(await screen.findByText(fa.settings.saved)).toBeInTheDocument();
    expect((await settingsRepo.get()).baseUrl).toBe('https://potlyapp.github.io');
  });

  it('rejects an invalid value without saving', async () => {
    render(<App />);
    await userEvent.type(await screen.findByLabelText(fa.settings.baseUrl), 'not a url');
    await userEvent.click(screen.getByRole('button', { name: fa.settings.save }));
    expect(await screen.findByText(fa.settings.baseUrlInvalid)).toBeInTheDocument();
    expect((await settingsRepo.get()).baseUrl).toBeNull();
  });

  it('clearing the field goes back to the running origin', async () => {
    await settingsRepo.update({ baseUrl: 'https://potlyapp.github.io' });
    render(<App />);
    const field = await screen.findByLabelText(fa.settings.baseUrl);
    await userEvent.clear(field);
    await userEvent.click(screen.getByRole('button', { name: fa.settings.save }));
    expect(await screen.findByText(fa.settings.saved)).toBeInTheDocument();
    expect((await settingsRepo.get()).baseUrl).toBeNull();
  });
});
