import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { plantsRepo } from '../../data/plants';
import { fa } from '../../i18n/fa';

function go(path: string) {
  window.history.pushState({}, '', path);
}

describe('plants flow', () => {
  beforeEach(() => go('/plants'));

  it('shows the empty state when there are no plants', async () => {
    render(<App />);
    expect(await screen.findByText(fa.plants.emptyTitle)).toBeInTheDocument();
  });

  it('saves a name-only plant and lists it', async () => {
    go('/plants/new');
    render(<App />);
    await userEvent.type(await screen.findByLabelText(fa.form.name), 'مونسترا');
    await userEvent.click(screen.getByRole('button', { name: fa.form.save }));

    expect(await screen.findByRole('link', { name: /مونسترا/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/plants');

    const [saved] = await plantsRepo.list();
    expect(saved?.name).toBe('مونسترا');
    expect(saved?.light).toBe('unknown');
    expect(saved?.species).toBeNull();
  });

  it('blocks an empty name with an accessible error', async () => {
    go('/plants/new');
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: fa.form.save }));
    expect(screen.getByLabelText(fa.form.name)).toBeInvalid();
    expect(screen.getByText(fa.form.nameRequired)).toBeInTheDocument();
    expect(await plantsRepo.list()).toHaveLength(0);
  });

  it('save-and-add-another keeps the page, clears the form, and stores both', async () => {
    go('/plants/new');
    render(<App />);
    const name = screen.getByLabelText(fa.form.name);
    await userEvent.type(name, 'اول');
    await userEvent.click(screen.getByRole('button', { name: fa.form.saveAndAnother }));

    expect(await screen.findByText(fa.form.saved('اول'))).toBeInTheDocument();
    expect(window.location.pathname).toBe('/plants/new');
    await waitFor(() => expect(screen.getByLabelText(fa.form.name)).toHaveValue(''));

    await userEvent.type(screen.getByLabelText(fa.form.name), 'دوم');
    await userEvent.click(screen.getByRole('button', { name: fa.form.save }));
    await screen.findByRole('link', { name: /دوم/ });

    const names = (await plantsRepo.list()).map((p) => p.name);
    expect(names).toEqual(['اول', 'دوم']);
  });

  it('edits a plant and the change persists', async () => {
    const plant = await plantsRepo.create({ name: 'قدیمی' });
    go(`/plants/${plant.id}/edit`);
    render(<App />);

    const name = await screen.findByLabelText(fa.form.name);
    expect(name).toHaveValue('قدیمی');
    await userEvent.clear(name);
    await userEvent.type(name, 'جدید');
    await userEvent.click(screen.getByText(fa.form.more));
    await userEvent.type(screen.getByLabelText(fa.form.room), 'آشپزخانه');
    await userEvent.selectOptions(screen.getByLabelText(fa.form.light), 'bright');
    await userEvent.click(screen.getByRole('button', { name: fa.form.save }));

    expect(await screen.findByRole('heading', { name: 'جدید', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/p/${plant.id}`);
    const saved = await plantsRepo.get(plant.id);
    expect(saved?.name).toBe('جدید');
    expect(saved?.room).toBe('آشپزخانه');
    expect(saved?.light).toBe('bright');
    expect(saved?.id).toBe(plant.id);
  });

  it('shows not-found for an unknown plant id', async () => {
    go('/plants/AAAAAAAAAAAAAAAAAAAAAA/edit');
    render(<App />);
    expect(await screen.findByRole('heading', { name: fa.form.notFound })).toBeInTheDocument();
  });
});
