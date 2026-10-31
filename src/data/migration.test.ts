import Dexie from 'dexie';
import { PotlyDb } from './db';
import { createEventsRepo } from './events';
import { createPlantsRepo } from './plants';
import { DEFAULT_APP_SETTINGS } from '../domain/settings';
import { createSettingsRepo } from './settings';

let counter = 0;
const name = () => `migration-${counter++}-${Math.random()}`;

const STORES_V1 = { plants: 'id, name, room, archivedAt, createdAt', photos: 'plantId' };
const STORES_V2 = { ...STORES_V1, events: 'id, plantId, at, [plantId+at]' };

const plantRow = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `plant-${id}`,
  room: 'hall',
  archivedAt: null,
  createdAt: 1_700_000_000_000,
  lastWateredAt: 1_700_000_100_000,
  lastSoilCheckAt: 1_700_000_100_000,
  lastFertilizedAt: null,
  ...extra,
});

const eventRow = (id: string, plantId: string, at: number) => ({
  id,
  plantId,
  task: 'water',
  kind: 'done',
  at,
  seasonAtTime: 'summer',
  snoozeUntilDay: null,
  undoesId: null,
  note: '',
});

describe('database upgrade v2 → v3', () => {
  it('keeps every plant and event untouched and adds a working settings table', async () => {
    const n = name();
    const v2 = new Dexie(n);
    v2.version(1).stores(STORES_V1);
    v2.version(2).stores(STORES_V2);
    await v2.table('plants').bulkAdd([plantRow('a'), plantRow('b', { room: 'kitchen', lastWateredAt: null })]);
    await v2.table('events').bulkAdd([eventRow('e1', 'a', 1_700_000_100_000), eventRow('e2', 'a', 1_700_000_200_000)]);
    expect(v2.tables.map((t) => t.name).sort()).toEqual(['events', 'photos', 'plants']);
    v2.close();

    const db = new PotlyDb(n);
    await db.open();

    expect(db.verno).toBe(3);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['events', 'photos', 'plants', 'settings']);
    expect(await db.plants.count()).toBe(2);
    expect(await db.plants.get('a')).toEqual(plantRow('a'));
    expect(await db.plants.get('b')).toEqual(plantRow('b', { room: 'kitchen', lastWateredAt: null }));
    expect(await db.events.orderBy('at').primaryKeys()).toEqual(['e1', 'e2']);
    expect(await db.events.where('[plantId+at]').between(['a', 0], ['a', Infinity]).count()).toBe(2);
    expect(await db.settings.count()).toBe(0);

    const settings = createSettingsRepo(db);
    expect(await settings.get()).toEqual(DEFAULT_APP_SETTINGS);
    await settings.update({ checkedMoistGapDays: 5 });
    expect((await settings.get()).checkedMoistGapDays).toBe(5);
    db.close();
  });

  it('keeps existing indexes usable after the upgrade', async () => {
    const n = name();
    const v2 = new Dexie(n);
    v2.version(1).stores(STORES_V1);
    v2.version(2).stores(STORES_V2);
    await v2.table('plants').bulkAdd([plantRow('a'), plantRow('b', { room: 'kitchen' })]);
    v2.close();

    const db = new PotlyDb(n);
    expect((await db.plants.where('room').equals('kitchen').toArray()).map((p) => p.id)).toEqual(['b']);
    expect((await db.plants.orderBy('createdAt').toArray()).map((p) => p.id).sort()).toEqual(['a', 'b']);
    db.close();
  });

  it('is idempotent: reopening an upgraded database changes nothing', async () => {
    const n = name();
    const v2 = new Dexie(n);
    v2.version(1).stores(STORES_V1);
    v2.version(2).stores(STORES_V2);
    await v2.table('plants').add(plantRow('a'));
    v2.close();

    const first = new PotlyDb(n);
    await first.open();
    first.close();
    const second = new PotlyDb(n);
    expect(await second.plants.get('a')).toEqual(plantRow('a'));
    expect(second.verno).toBe(3);
    second.close();
  });

  it('upgrades v1 → v3 in one step, backfilling plant caches', async () => {
    const n = name();
    const v1 = new Dexie(n);
    v1.version(1).stores(STORES_V1);
    await v1.table('plants').add({ id: 'old', name: 'قدیمی', room: '', archivedAt: null, createdAt: 1 });
    v1.close();

    const db = new PotlyDb(n);
    expect(await db.plants.get('old')).toMatchObject({
      name: 'قدیمی',
      lastWateredAt: null,
      lastSoilCheckAt: null,
      lastFertilizedAt: null,
    });
    expect(await db.events.count()).toBe(0);
    expect(await db.settings.count()).toBe(0);
    db.close();
  });

  it('new writes after upgrade still work through the repositories', async () => {
    const n = name();
    const v2 = new Dexie(n);
    v2.version(1).stores(STORES_V1);
    v2.version(2).stores(STORES_V2);
    const oldId = 'AAAAAAAAAAAAAAAAAAAAAA';
    await v2.table('plants').add(plantRow(oldId));
    v2.close();

    const db = new PotlyDb(n);
    const plants = createPlantsRepo(db);
    const events = createEventsRepo(db);
    const created = await plants.create({ name: 'جدید' });
    await events.record({ plantId: oldId, task: 'water', kind: 'skipped' });
    expect(await plants.list()).toHaveLength(2);
    expect(await db.events.where('plantId').equals(oldId).count()).toBe(1);
    expect(created.id).not.toBe(oldId);
    db.close();
  });
});
