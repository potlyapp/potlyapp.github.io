import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { eventsRepo } from '../../data/events';
import { plantsRepo } from '../../data/plants';
import { settingsRepo } from '../../data/settings';
import { seasonFor } from '../../domain/season';
import { SEASONS } from '../../domain/schemas';
import { fa } from '../../i18n/fa';

function go(path: string) {
  window.history.pushState({}, '', path);
}

describe('settings page', () => {
  beforeEach(() => go('/settings'));

  it('saves a calendar change', async () => {
    render(<App />);
    await userEvent.selectOptions(await screen.findByLabelText(fa.settings.calendar), 'gregorian');
    await userEvent.click(screen.getByRole('button', { name: fa.settings.save }));
    expect(await screen.findByText(fa.settings.saved)).toBeInTheDocument();
    expect((await settingsRepo.get()).calendar).toBe('gregorian');
  });

  it('rejects an invalid time zone without saving', async () => {
    render(<App />);
    const tz = await screen.findByLabelText(fa.settings.timeZone);
    await userEvent.clear(tz);
    await userEvent.type(tz, 'Mars/Base');
    await userEvent.click(screen.getByRole('button', { name: fa.settings.save }));
    expect(await screen.findByText(fa.settings.timeZoneInvalid)).toBeInTheDocument();
    expect((await settingsRepo.get()).timeZone).toBe('Asia/Tehran');
  });

  it('states that data is local-only', async () => {
    render(<App />);
    expect(await screen.findByText(fa.settings.localOnly)).toBeInTheDocument();
  });
});

describe('schedule editor', () => {
  it('saves an interval as a user value and the plant then shows up on Today', async () => {
    const plant = await plantsRepo.create({ name: 'پتوس' });
    go(`/p/${plant.id}/schedule`);
    render(<App />);

    const now = Date.now();
    const season = seasonFor(now, 'Asia/Tehran', 'persian');
    const label = fa.schedule.taskInSeason(fa.tasks.water, fa.seasons[season]);
    await userEvent.selectOptions(await screen.findByLabelText(label), 'interval');
    await userEvent.type(screen.getByLabelText(fa.schedule.everyDaysFor(fa.tasks.water, fa.seasons[season])), '4');
    await userEvent.click(screen.getByRole('button', { name: fa.form.save }));

    await waitFor(async () => {
      expect((await plantsRepo.get(plant.id))?.care[season].water).toEqual({ mode: 'interval', everyDays: 4, source: 'user' });
    });
    const saved = await plantsRepo.get(plant.id);
    for (const s of SEASONS.filter((x) => x !== season)) expect(saved?.care[s].water.mode).toBe('unknown');
    expect(await eventsRepo.listForPlant(plant.id)).toHaveLength(0);
  });

  it('shows an error for an invalid interval and saves nothing', async () => {
    const plant = await plantsRepo.create({ name: 'پتوس' });
    go(`/p/${plant.id}/schedule`);
    render(<App />);
    const season = seasonFor(Date.now(), 'Asia/Tehran', 'persian');
    await userEvent.selectOptions(
      await screen.findByLabelText(fa.schedule.taskInSeason(fa.tasks.water, fa.seasons[season])),
      'interval',
    );
    await userEvent.click(screen.getByRole('button', { name: fa.form.save }));
    expect(await screen.findByText(fa.schedule.intervalInvalid)).toBeInTheDocument();
    expect((await plantsRepo.get(plant.id))?.care[season].water.mode).toBe('unknown');
  });
});

describe('season banner', () => {
  beforeEach(() => go('/'));

  it('records the current season silently on first run', async () => {
    render(<App />);
    const season = seasonFor(Date.now(), 'Asia/Tehran', 'persian');
    await waitFor(async () => expect((await settingsRepo.get()).lastSeenSeason).toBe(season));
    expect(screen.queryByText(fa.season.ack)).not.toBeInTheDocument();
  });

  it('announces a season change, counts plants without a schedule, and acknowledges', async () => {
    const current = seasonFor(Date.now(), 'Asia/Tehran', 'persian');
    const other = SEASONS.find((s) => s !== current)!;
    await settingsRepo.markSeasonSeen(other);
    await plantsRepo.create({ name: 'بی‌برنامه' });
    render(<App />);

    expect(await screen.findByText(fa.season.changedTitle(fa.seasons[other], fa.seasons[current]))).toBeInTheDocument();
    expect(screen.getByText(fa.season.missing(1))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: fa.season.ack }));
    await waitFor(() => expect(screen.queryByRole('button', { name: fa.season.ack })).not.toBeInTheDocument());
    expect((await settingsRepo.get()).lastSeenSeason).toBe(current);
  });
});
