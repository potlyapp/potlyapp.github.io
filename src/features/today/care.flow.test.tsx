import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { db } from '../../data/db';
import { eventsRepo } from '../../data/events';
import { plantsRepo } from '../../data/plants';
import { buildPlant } from '../../domain/defaults';
import { newId } from '../../domain/id';
import { SEASONS, type Plant } from '../../domain/schemas';
import { fa } from '../../i18n/fa';

const DAY = 86_400_000;

function go(path: string) {
  window.history.pushState({}, '', path);
}

/** A plant whose every season has the given water interval and was created `ageDays` ago. */
async function duePlant(name: string, opts: { everyDays?: number; ageDays?: number; room?: string } = {}): Promise<Plant> {
  const { everyDays = 3, ageDays = 10, room } = opts;
  const plant = buildPlant(newId(), { name, room }, Date.now() - ageDays * DAY);
  for (const s of SEASONS) plant.care[s].water = { mode: 'interval', everyDays, source: 'user' };
  await db.plants.add(plant);
  return plant;
}

describe('Today page', () => {
  beforeEach(() => go('/'));

  it('shows the empty state when no plant has a schedule', async () => {
    await plantsRepo.create({ name: 'بی‌برنامه' });
    render(<App />);
    expect(await screen.findByText(fa.today.emptyTitle)).toBeInTheDocument();
  });

  it('lists an overdue task with a "check soil" wording, never "water now"', async () => {
    await duePlant('مونسترا');
    render(<App />);
    expect(await screen.findByRole('link', { name: 'مونسترا' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(fa.tasks.water))).toBeInTheDocument();
    expect(screen.queryByText(/آب بده/)).not.toBeInTheDocument();
  });

  it('done records an event, removes the row, and offers undo that restores it', async () => {
    const p = await duePlant('فیکوس');
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: fa.actions.waterDone }));

    await waitFor(() => expect(screen.queryByRole('link', { name: 'فیکوس' })).not.toBeInTheDocument());
    const events = await eventsRepo.listForPlant(p.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'done', task: 'water' });
    expect((await plantsRepo.get(p.id))?.lastWateredAt).toBe(events[0]?.at);

    await userEvent.click(screen.getByRole('button', { name: fa.undo.button }));
    expect(await screen.findByRole('link', { name: 'فیکوس' })).toBeInTheDocument();
    const after = await eventsRepo.listForPlant(p.id);
    expect(after).toHaveLength(2);
    expect(after.some((e) => e.kind === 'done')).toBe(true);
    expect((await plantsRepo.get(p.id))?.lastWateredAt).toBeNull();
  });

  it('"checked — still moist" is recorded as checked_moist and hides the task', async () => {
    const p = await duePlant('الف');
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: fa.actions.stillMoist }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'الف' })).not.toBeInTheDocument());
    expect((await eventsRepo.listForPlant(p.id))[0]?.kind).toBe('checked_moist');
  });

  it('snooze and skip record their own kinds', async () => {
    const a = await duePlant('الف');
    const b = await duePlant('ب');
    render(<App />);
    const rowA = (await screen.findByRole('link', { name: 'الف' })).closest('li') as HTMLElement;
    await userEvent.click(within(rowA).getByRole('button', { name: fa.actions.snooze }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'الف' })).not.toBeInTheDocument());
    const rowB = screen.getByRole('link', { name: 'ب' }).closest('li') as HTMLElement;
    await userEvent.click(within(rowB).getByRole('button', { name: fa.actions.skip }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'ب' })).not.toBeInTheDocument());

    const [ea] = await eventsRepo.listForPlant(a.id);
    const [eb] = await eventsRepo.listForPlant(b.id);
    expect(ea?.kind).toBe('snoozed');
    expect(ea?.snoozeUntilDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(eb?.kind).toBe('skipped');
  });

  it('bulk action lists every selected plant, writes nothing until confirmed, then undoes as one', async () => {
    const ids = [(await duePlant('یک')).id, (await duePlant('دو')).id, (await duePlant('سه')).id];
    render(<App />);
    await screen.findByRole('link', { name: 'یک' });

    await userEvent.click(screen.getByRole('checkbox', { name: fa.today.selectRow('یک', fa.tasks.water) }));
    await userEvent.click(screen.getByRole('checkbox', { name: fa.today.selectRow('دو', fa.tasks.water) }));
    await userEvent.click(screen.getByRole('button', { name: fa.today.bulkDone }));

    const dialog = screen.getByRole('alertdialog');
    const listed = within(dialog).getAllByRole('listitem').map((li) => li.textContent);
    expect(listed).toHaveLength(2);
    expect(listed.join()).toContain('یک');
    expect(listed.join()).toContain('دو');
    expect(listed.join()).not.toContain('سه');
    expect(await db.events.count()).toBe(0);

    await userEvent.click(within(dialog).getByRole('button', { name: fa.today.bulkConfirm }));
    await waitFor(async () => expect(await db.events.count()).toBe(2));
    expect(await eventsRepo.listForPlant(ids[2] as string)).toHaveLength(0);

    await userEvent.click(await screen.findByRole('button', { name: fa.undo.button }));
    await waitFor(async () => expect(await db.events.count()).toBe(4));
    expect((await db.events.toArray()).filter((e) => e.kind === 'undo')).toHaveLength(2);
    expect(await screen.findByRole('link', { name: 'یک' })).toBeInTheDocument();
  });

  it('cancelling the bulk confirmation records nothing', async () => {
    await duePlant('یک');
    render(<App />);
    await userEvent.click(await screen.findByRole('checkbox', { name: fa.today.selectRow('یک', fa.tasks.water) }));
    await userEvent.click(screen.getByRole('button', { name: fa.today.bulkDone }));
    await userEvent.click(screen.getByRole('button', { name: fa.today.bulkCancel }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await db.events.count()).toBe(0);
  });

  it('does not show archived plants', async () => {
    const p = await duePlant('بایگانی');
    await plantsRepo.archive(p.id);
    render(<App />);
    expect(await screen.findByText(fa.today.emptyTitle)).toBeInTheDocument();
  });
});

describe('Plant detail page', () => {
  it('records manual actions, shows history, and undoes one entry without deleting it', async () => {
    const p = await plantsRepo.create({ name: 'کاکتوس' });
    go(`/p/${p.id}`);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'کاکتوس', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(fa.history.empty)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: fa.actions.waterDone }));
    await userEvent.click(screen.getByRole('button', { name: fa.actions.fertilizeDone }));
    await waitFor(() => expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2));
    expect((await eventsRepo.listForPlant(p.id)).map((e) => e.kind)).toEqual(['done', 'done']);

    const undoBtn = screen.getByRole('button', {
      name: `${fa.history.undoItem}: ${fa.history.kind.done.fertilize}`,
    });
    await userEvent.click(undoBtn);
    expect(await screen.findByText(fa.history.undone)).toBeInTheDocument();
    const all = await eventsRepo.listForPlant(p.id);
    expect(all).toHaveLength(3);
    expect((await plantsRepo.get(p.id))?.lastFertilizedAt).toBeNull();
    expect((await plantsRepo.get(p.id))?.lastWateredAt).not.toBeNull();
  });

  it('archiving needs confirmation and keeps history; unarchive brings it back', async () => {
    const p = await plantsRepo.create({ name: 'برای بایگانی' });
    await eventsRepo.record({ plantId: p.id, task: 'water', kind: 'done' });
    go(`/p/${p.id}`);
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: fa.detail.archive }));
    expect(await plantsRepo.list()).toHaveLength(1);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: fa.detail.confirm }));
    expect(await screen.findByText(fa.detail.archivedBanner)).toBeInTheDocument();
    expect(await plantsRepo.list()).toHaveLength(0);
    expect(await eventsRepo.listForPlant(p.id)).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: fa.detail.unarchive }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: fa.detail.confirm }));
    await waitFor(async () => expect(await plantsRepo.list()).toHaveLength(1));
  });

  it('permanent delete asks first, cancel keeps the plant, confirm removes plant and history', async () => {
    const p = await plantsRepo.create({ name: 'حذفی' });
    await eventsRepo.record({ plantId: p.id, task: 'water', kind: 'done' });
    go(`/p/${p.id}`);
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: fa.detail.remove }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: fa.detail.cancel }));
    expect(await plantsRepo.get(p.id)).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: fa.detail.remove }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: fa.detail.remove }));
    await waitFor(() => expect(window.location.pathname).toBe('/plants'));
    expect(await plantsRepo.get(p.id)).toBeUndefined();
    expect(await db.events.count()).toBe(0);
  });

  it('shows not-found for an unknown id', async () => {
    go('/p/AAAAAAAAAAAAAAAAAAAAAA');
    render(<App />);
    expect(await screen.findByRole('heading', { name: fa.form.notFound })).toBeInTheDocument();
  });
});

describe('Plants list search and filters', () => {
  beforeEach(() => go('/plants'));

  it('filters by search text and offers a way to clear when nothing matches', async () => {
    await plantsRepo.create({ name: 'مونسترا', room: 'نشیمن' });
    await plantsRepo.create({ name: 'فیکوس', room: 'آشپزخانه' });
    render(<App />);
    await screen.findByRole('link', { name: /مونسترا/ });

    await userEvent.type(screen.getByLabelText(fa.plants.search), 'فیکوس');
    expect(screen.queryByRole('link', { name: /مونسترا/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /فیکوس/ })).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(fa.plants.search));
    await userEvent.type(screen.getByLabelText(fa.plants.search), 'zzz');
    await userEvent.click(await screen.findByRole('button', { name: fa.plants.clearFilters }));
    expect(await screen.findByRole('link', { name: /مونسترا/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /فیکوس/ })).toBeInTheDocument();
  });

  it('filters by room and by due status', async () => {
    await plantsRepo.create({ name: 'مونسترا', room: 'نشیمن' });
    await duePlant('سررسید', { room: 'آشپزخانه' });
    render(<App />);
    await screen.findByRole('link', { name: /مونسترا/ });

    await userEvent.selectOptions(screen.getByLabelText(fa.plants.room), 'نشیمن');
    expect(screen.queryByRole('link', { name: /سررسید/ })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(fa.plants.room), '');
    await userEvent.selectOptions(screen.getByLabelText(fa.plants.status), 'due');
    expect(screen.queryByRole('link', { name: /مونسترا/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /سررسید/ })).toBeInTheDocument();
  });

  it('lists archived plants in a separate section linking to their detail page', async () => {
    const p = await plantsRepo.create({ name: 'قدیمی' });
    await plantsRepo.archive(p.id);
    render(<App />);
    const link = await screen.findByRole('link', { name: /قدیمی/, hidden: true });
    expect(link).toHaveAttribute('href', `/p/${p.id}`);
  });
});
