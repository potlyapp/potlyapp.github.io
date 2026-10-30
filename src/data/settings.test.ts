import { db } from './db';
import { eventsRepo } from './events';
import { plantsRepo } from './plants';
import { settingsRepo } from './settings';
import { DEFAULT_APP_SETTINGS } from '../domain/settings';
import { SEASONS } from '../domain/schemas';

describe('settings repo', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await settingsRepo.get()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('persists a valid patch and keeps untouched fields', async () => {
    const next = await settingsRepo.update({ calendar: 'gregorian' });
    expect(next).toEqual({ ...DEFAULT_APP_SETTINGS, calendar: 'gregorian' });
    expect(await settingsRepo.get()).toEqual(next);
  });

  it('rejects an invalid time zone and gap, storing nothing', async () => {
    await expect(settingsRepo.update({ timeZone: 'Mars/Base' })).rejects.toThrow();
    await expect(settingsRepo.update({ checkedMoistGapDays: 0 })).rejects.toThrow();
    expect(await db.settings.count()).toBe(0);
  });

  it('falls back to defaults on a corrupt row', async () => {
    await db.settings.put({ key: 'app', ...DEFAULT_APP_SETTINGS, timeZone: 'nope' });
    expect(await settingsRepo.get()).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('records the last seen season', async () => {
    await settingsRepo.markSeasonSeen('winter');
    expect((await settingsRepo.get()).lastSeenSeason).toBe('winter');
  });

  it('events repo uses the persisted checked-moist gap', async () => {
    const plant = await plantsRepo.create({ name: 'x' });
    await settingsRepo.update({ checkedMoistGapDays: 5 });
    const e = await eventsRepo.record({ plantId: plant.id, task: 'water', kind: 'checked_moist' });
    expect(e.kind).toBe('checked_moist');
    expect(await db.events.count()).toBe(1);
  });
});

describe('plantsRepo.setCare', () => {
  it('saves valid care settings', async () => {
    const plant = await plantsRepo.create({ name: 'p' });
    const care = structuredClone(plant.care);
    for (const s of SEASONS) care[s].water = { mode: 'interval', everyDays: 7, source: 'user' };
    await plantsRepo.setCare(plant.id, care);
    expect((await plantsRepo.get(plant.id))?.care.summer.water).toEqual({ mode: 'interval', everyDays: 7, source: 'user' });
  });

  it('rejects an invalid interval and leaves the plant unchanged', async () => {
    const plant = await plantsRepo.create({ name: 'p' });
    const care = structuredClone(plant.care);
    care.spring.water = { mode: 'interval', everyDays: 0, source: 'user' };
    await expect(plantsRepo.setCare(plant.id, care)).rejects.toThrow();
    expect((await plantsRepo.get(plant.id))?.care.spring.water.mode).toBe('unknown');
  });
});

describe('notification settings', () => {
  it('default to off with no day recorded', async () => {
    const s = await settingsRepo.get();
    expect(s.notificationsEnabled).toBe(false);
    expect(s.lastNotifiedDay).toBeNull();
  });

  it('persist enabled flag and last notified day', async () => {
    await settingsRepo.update({ notificationsEnabled: true, lastNotifiedDay: '2026-03-21' });
    const s = await settingsRepo.get();
    expect(s.notificationsEnabled).toBe(true);
    expect(s.lastNotifiedDay).toBe('2026-03-21');
  });
});
