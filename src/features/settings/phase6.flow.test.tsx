import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { DEMO_NAMES } from '../../data/demo';
import { backupRepo } from '../../data/backup';
import { eventsRepo } from '../../data/events';
import { plantsRepo } from '../../data/plants';
import { settingsRepo } from '../../data/settings';
import { fa } from '../../i18n/fa';
import { pwaStore } from '../../pwa/pwaState';

function go(path: string) {
  window.history.pushState({}, '', path);
}

function jsonFile(content: unknown, name = 'backup.json') {
  return new File([typeof content === 'string' ? content : JSON.stringify(content)], name, { type: 'application/json' });
}

describe('backup section', () => {
  beforeEach(() => go('/settings'));

  it('previews a valid file, then merges it', async () => {
    const source = await plantsRepo.create({ name: 'Source' });
    await eventsRepo.record({ plantId: source.id, task: 'water', kind: 'done' });
    const exported = await backupRepo.export();
    await plantsRepo.remove(source.id);
    expect(await plantsRepo.list()).toHaveLength(0);

    render(<App />);
    await userEvent.upload(await screen.findByLabelText(fa.backup.file), jsonFile(exported));
    expect(await screen.findByText(fa.backup.preview(1, 1, 0))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: fa.backup.import }));
    expect(await screen.findByText(fa.backup.done(1, 0, 1))).toBeInTheDocument();
    expect((await plantsRepo.list()).map((p) => p.name)).toEqual(['Source']);
  });

  it('rejects a bad file and changes nothing', async () => {
    await plantsRepo.create({ name: 'Keep' });
    render(<App />);
    await userEvent.upload(await screen.findByLabelText(fa.backup.file), jsonFile('not json'));
    expect(await screen.findByText(fa.backup.invalidTitle)).toBeInTheDocument();
    expect(screen.getByText(fa.backup.errors.not_json)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: fa.backup.import })).not.toBeInTheDocument();
    expect((await plantsRepo.list()).map((p) => p.name)).toEqual(['Keep']);
  });

  it('asks for confirmation before replacing, and cancel keeps the data', async () => {
    const other = await plantsRepo.create({ name: 'FromFile' });
    const exported = await backupRepo.export();
    await plantsRepo.remove(other.id);
    await plantsRepo.create({ name: 'Local' });

    render(<App />);
    await userEvent.upload(await screen.findByLabelText(fa.backup.file), jsonFile(exported));
    await userEvent.click(await screen.findByLabelText(fa.backup.replace));
    await userEvent.click(screen.getByRole('button', { name: fa.backup.import }));

    expect(await screen.findByText(fa.backup.confirmTitle)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: fa.backup.cancel }));
    expect((await plantsRepo.list()).map((p) => p.name)).toEqual(['Local']);

    await userEvent.click(screen.getByRole('button', { name: fa.backup.import }));
    await userEvent.click(await screen.findByRole('button', { name: fa.backup.confirm }));
    await waitFor(async () => expect((await plantsRepo.list()).map((p) => p.name)).toEqual(['FromFile']));
  });
});

describe('csv import section', () => {
  beforeEach(() => go('/settings'));

  it('imports valid rows and reports the invalid ones', async () => {
    render(<App />);
    const file = new File(['name,room\nپتوس,اتاق\n,x\nفیکوس,\n'], 'plants.csv', { type: 'text/csv' });
    await userEvent.upload(await screen.findByLabelText(fa.csv.file), file);

    const summary = await screen.findByText(fa.csv.valid(2), { exact: false });
    expect(summary).toHaveTextContent(fa.csv.valid(2));
    expect(summary).toHaveTextContent(fa.csv.invalid(1));

    await userEvent.click(screen.getByRole('button', { name: fa.csv.import(2) }));
    expect(await screen.findByText(fa.csv.done(2))).toBeInTheDocument();
    const names = (await plantsRepo.list()).map((p) => p.name).sort();
    expect(names).toEqual(['پتوس', 'فیکوس'].sort());
  });

  it('refuses a file without a name column', async () => {
    render(<App />);
    await userEvent.upload(await screen.findByLabelText(fa.csv.file), new File(['room\nx\n'], 'p.csv', { type: 'text/csv' }));
    expect(await screen.findByText(new RegExp(fa.csv.errors.no_name_column))).toBeInTheDocument();
    expect(await plantsRepo.list()).toHaveLength(0);
  });
});

describe('demo section', () => {
  it('loads labelled demo plants, shows the badge, and removes only them', async () => {
    await plantsRepo.create({ name: 'Real' });
    go('/settings');
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: fa.demo.load }));
    expect(await screen.findByText(fa.demo.loaded)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: fa.demo.remove(3) }));
    await userEvent.click(screen.getByRole('button', { name: fa.demo.confirm }));
    expect(await screen.findByText(fa.demo.removed(3))).toBeInTheDocument();
    expect((await plantsRepo.list()).map((p) => p.name)).toEqual(['Real']);
  });

  it('marks demo plants in the plant list', async () => {
    go('/settings');
    const view = render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: fa.demo.load }));
    await screen.findByText(fa.demo.loaded);
    view.unmount();

    go('/plants');
    render(<App />);
    for (const name of DEMO_NAMES) {
      const link = (await screen.findAllByText(name))[0]!.closest('a')!;
      expect(link.querySelector('.badge-demo')).toHaveTextContent(fa.demo.badge);
    }
  });
});

describe('notifications section', () => {
  const original = (globalThis as { Notification?: unknown }).Notification;

  afterEach(() => {
    (globalThis as { Notification?: unknown }).Notification = original;
  });

  it('says so when the browser has no notification support', async () => {
    delete (globalThis as { Notification?: unknown }).Notification;
    go('/settings');
    render(<App />);
    expect(await screen.findAllByText(fa.notifications.unsupported)).not.toHaveLength(0);
    expect(screen.queryByLabelText(fa.notifications.toggle)).not.toBeInTheDocument();
    expect(screen.getByText(fa.notifications.limits)).toBeInTheDocument();
  });

  it('stays off and explains when permission is denied', async () => {
    (globalThis as { Notification?: unknown }).Notification = Object.assign(function () {}, {
      permission: 'default',
      requestPermission: () => Promise.resolve('denied'),
    });
    go('/settings');
    render(<App />);
    await userEvent.click(await screen.findByLabelText(fa.notifications.toggle));
    expect((await screen.findAllByText(fa.notifications.denied)).length).toBeGreaterThan(0);
    expect((await settingsRepo.get()).notificationsEnabled).toBe(false);
    expect(screen.getByLabelText(fa.notifications.toggle)).not.toBeChecked();
  });

  it('enables and persists when permission is granted', async () => {
    (globalThis as { Notification?: unknown }).Notification = Object.assign(function () {}, {
      permission: 'default',
      requestPermission: () => Promise.resolve('granted'),
    });
    go('/settings');
    render(<App />);
    await userEvent.click(await screen.findByLabelText(fa.notifications.toggle));
    expect(await screen.findByText(fa.notifications.enabled)).toBeInTheDocument();
    expect((await settingsRepo.get()).notificationsEnabled).toBe(true);
  });
});

describe('pwa banner', () => {
  beforeEach(() => {
    pwaStore.reset();
    go('/');
  });
  afterEach(() => pwaStore.reset());

  it('stays hidden until there is something to say', async () => {
    render(<App />);
    await screen.findByRole('banner');
    expect(screen.queryByText(fa.pwa.updateAvailable)).not.toBeInTheDocument();
    expect(screen.queryByText(fa.pwa.offlineReady)).not.toBeInTheDocument();
  });

  it('offers an update and runs it on request', async () => {
    const updater = vi.fn(() => Promise.resolve());
    pwaStore.setUpdater(updater);
    render(<App />);
    act(() => pwaStore.setNeedRefresh(true));
    await userEvent.click(await screen.findByRole('button', { name: fa.pwa.update }));
    expect(updater).toHaveBeenCalledTimes(1);
  });

  it('announces offline readiness and can be dismissed', async () => {
    render(<App />);
    act(() => pwaStore.setOfflineReady(true));
    expect(await screen.findByText(fa.pwa.offlineReady)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: fa.pwa.dismiss }));
    expect(screen.queryByText(fa.pwa.offlineReady)).not.toBeInTheDocument();
  });

  it('shows an offline badge when the browser goes offline', async () => {
    render(<App />);
    await screen.findByRole('banner');
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(await screen.findByText(fa.pwa.offline)).toBeInTheDocument();
    online.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(screen.queryByText(fa.pwa.offline)).not.toBeInTheDocument());
    online.mockRestore();
  });
});
