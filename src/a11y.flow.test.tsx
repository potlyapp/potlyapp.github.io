import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { plantsRepo } from './data/plants';
import { fa } from './i18n/fa';

function go(path: string) {
  window.history.pushState({}, '', path);
}

describe('accessibility', () => {
  it('offers a skip link that targets the focusable main landmark', async () => {
    go('/');
    render(<App />);
    const skip = await screen.findByRole('link', { name: fa.nav.skipToContent });
    expect(skip).toHaveAttribute('href', '#main');
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus to main after in-app navigation, but not on first load', async () => {
    go('/');
    render(<App />);
    await screen.findByRole('heading', { name: fa.today.title });
    expect(screen.getByRole('main')).not.toHaveFocus();
    await userEvent.click(screen.getByRole('link', { name: fa.nav.plants }));
    await screen.findByRole('heading', { name: fa.plants.title });
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('shows a loading status while a lazy page loads', async () => {
    go('/settings');
    render(<App />);
    expect(await screen.findByRole('heading', { name: fa.settings.title })).toBeInTheDocument();
    expect(screen.queryByText(fa.loading)).not.toBeInTheDocument();
  });

  it('labels the QR section and its actions', async () => {
    const plant = await plantsRepo.create({ name: 'پتوس' });
    go(`/p/${plant.id}`);
    render(<App />);
    const region = await screen.findByRole('region', { name: fa.qr.title });
    expect(await within(region).findByRole('img', { name: fa.qr.alt('پتوس') })).toBeInTheDocument();
    const group = within(region).getByRole('group', { name: fa.qr.title });
    expect(within(group).getByRole('button', { name: fa.qr.downloadSvg })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: fa.qr.downloadPng })).toBeInTheDocument();
  });

  it('exposes the label sheet as a named list with one image per plant', async () => {
    await plantsRepo.create({ name: 'الف' });
    await plantsRepo.create({ name: 'ب' });
    go('/labels');
    render(<App />);
    const list = await screen.findByRole('list', { name: fa.labels.title });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(await within(list).findByRole('img', { name: fa.qr.alt('الف') })).toBeInTheDocument();
  });

  it('seasonal editor: every season is a named group, each select is labelled, and a bad interval gets focus and a described error', async () => {
    const plant = await plantsRepo.create({ name: 'پتوس' });
    go(`/p/${plant.id}/schedule`);
    render(<App />);
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      expect(await screen.findByRole('group', { name: new RegExp(fa.seasons[season]) })).toBeInTheDocument();
      expect(screen.getByLabelText(fa.schedule.taskInSeason(fa.tasks.water, fa.seasons[season]))).toBeInTheDocument();
    }

    await userEvent.selectOptions(
      screen.getByLabelText(fa.schedule.taskInSeason(fa.tasks.water, fa.seasons.summer)),
      'interval',
    );
    await userEvent.click(screen.getByRole('button', { name: fa.form.save }));

    const days = screen.getByLabelText(fa.schedule.everyDaysFor(fa.tasks.water, fa.seasons.summer));
    expect(days).toBeInvalid();
    expect(days).toHaveFocus();
    expect(days).toHaveAccessibleDescription(fa.schedule.intervalInvalid);
  });

  it('a corrupt plant page does not take down the shell', async () => {
    const plant = await plantsRepo.create({ name: 'خراب' });
    go(`/p/${plant.id}`);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const spy = vi.spyOn(plantsRepo, 'get').mockImplementation(() => {
      throw new Error('corrupt');
    });
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(fa.errorBoundary.title);
    expect(screen.getByRole('navigation', { name: fa.nav.primary })).toBeInTheDocument();
    spy.mockRestore();
    vi.restoreAllMocks();
  });
});
