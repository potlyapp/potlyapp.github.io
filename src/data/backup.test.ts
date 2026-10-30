import { BACKUP_FORMAT, BACKUP_VERSION, backupFileName, parseBackup, type Backup } from '../domain/backup';
import { createBackupRepo } from './backup';
import { PotlyDb } from './db';
import { createDemoRepo, DEMO_NAMES } from './demo';
import { createEventsRepo } from './events';
import { createPlantsRepo } from './plants';

let counter = 0;
function fresh() {
  const db = new PotlyDb(`backup-test-${counter++}-${Math.random()}`);
  let t = 1_700_000_000_000;
  const clock = () => (t += 1000);
  return {
    db,
    clock,
    plants: createPlantsRepo(db, clock),
    events: createEventsRepo(db, clock),
    backup: createBackupRepo(db, clock),
    demo: createDemoRepo(db, clock),
  };
}

async function seeded() {
  const env = fresh();
  const a = await env.plants.create({ name: 'A' });
  const b = await env.plants.create({ name: 'B' });
  const watered = await env.events.record({ plantId: a.id, task: 'water', kind: 'done' });
  return { ...env, a, b, watered };
}

function clone(b: Backup): Backup {
  return JSON.parse(JSON.stringify(b)) as Backup;
}

describe('parseBackup', () => {
  it('accepts an exported backup', async () => {
    const { backup } = await seeded();
    const exported = await backup.export();
    const result = parseBackup(JSON.stringify(exported));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.plants).toHaveLength(2);
      expect(result.backup.events).toHaveLength(1);
    }
  });

  it('rejects text that is not JSON', () => {
    expect(parseBackup('nope')).toEqual({ ok: false, errors: [{ code: 'not_json' }] });
  });

  it('rejects JSON that is not a backup', () => {
    expect(parseBackup('{"a":1}')).toEqual({ ok: false, errors: [{ code: 'not_backup' }] });
    expect(parseBackup('[]')).toEqual({ ok: false, errors: [{ code: 'not_backup' }] });
    expect(parseBackup('null')).toEqual({ ok: false, errors: [{ code: 'not_backup' }] });
  });

  it('rejects a newer version instead of guessing', async () => {
    const { backup } = await seeded();
    const file = { ...(await backup.export()), version: BACKUP_VERSION + 1 };
    expect(parseBackup(JSON.stringify(file))).toEqual({ ok: false, errors: [{ code: 'newer_version' }] });
  });

  it('reports schema problems with a path', async () => {
    const { backup } = await seeded();
    const file = clone(await backup.export());
    (file.plants[0] as { name: string }).name = '';
    const result = parseBackup(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toEqual({ code: 'invalid', path: 'plants[0].name' });
  });

  it('detects duplicate plants and events', async () => {
    const { backup } = await seeded();
    const file = clone(await backup.export());
    file.plants.push(file.plants[0]!);
    file.events.push(file.events[0]!);
    const result = parseBackup(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('duplicate_plant');
      expect(codes).toContain('duplicate_event');
    }
  });

  it('detects events whose plant is missing', async () => {
    const { backup } = await seeded();
    const file = clone(await backup.export());
    file.events[0]!.plantId = file.plants[0]!.id === file.events[0]!.plantId ? file.plants[1]!.id : file.plants[0]!.id;
    file.plants = file.plants.filter((p) => p.id !== file.events[0]!.plantId);
    const result = parseBackup(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.code)).toContain('orphan_event');
  });

  it('detects an undo that points at nothing', async () => {
    const { backup, a } = await seeded();
    const file = clone(await backup.export());
    file.events.push({
      ...file.events[0]!,
      id: 'AAAAAAAAAAAAAAAAAAAAAA',
      plantId: a.id,
      kind: 'undo',
      undoesId: 'BBBBBBBBBBBBBBBBBBBBBB',
    });
    const result = parseBackup(JSON.stringify(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.code)).toContain('bad_undo');
  });

  it('names the file by day', () => {
    expect(backupFileName('2026-03-21')).toBe('potly-backup-2026-03-21.json');
  });
});

describe('backup repository', () => {
  it('exports format, version, plants, events and settings', async () => {
    const { backup, a, watered } = await seeded();
    const out = await backup.export();
    expect(out.format).toBe(BACKUP_FORMAT);
    expect(out.version).toBe(BACKUP_VERSION);
    expect(out.plants.map((p) => p.name)).toEqual(['A', 'B']);
    expect(out.events[0]?.id).toBe(watered.id);
    expect(out.events[0]?.plantId).toBe(a.id);
    expect(out.settings.timeZone).toBe('Asia/Tehran');
  });

  it('round-trips into an empty database with replace', async () => {
    const source = await seeded();
    const exported = await source.backup.export();
    const target = fresh();
    const summary = await target.backup.import(exported, 'replace');
    expect(summary).toMatchObject({ plantsAdded: 2, eventsAdded: 1 });
    expect(await target.backup.export()).toEqual({ ...exported, exportedAt: expect.any(Number) });
  });

  it('replace discards what was there before', async () => {
    const source = await seeded();
    const exported = await source.backup.export();
    const target = fresh();
    await target.plants.create({ name: 'Old' });
    await target.backup.import(exported, 'replace');
    expect((await target.plants.list()).map((p) => p.name).sort()).toEqual(['A', 'B']);
  });

  it('merge adds missing plants and events and keeps local ones', async () => {
    const source = await seeded();
    const exported = await source.backup.export();
    const target = fresh();
    const local = await target.plants.create({ name: 'Local' });
    const summary = await target.backup.import(exported, 'merge');
    expect(summary).toMatchObject({ plantsAdded: 2, plantsUpdated: 0, eventsAdded: 1 });
    const names = (await target.plants.list()).map((p) => p.name).sort();
    expect(names).toEqual(['A', 'B', 'Local']);
    expect(await target.plants.get(local.id)).toBeDefined();
  });

  it('merge twice does not duplicate anything', async () => {
    const source = await seeded();
    const exported = await source.backup.export();
    const target = fresh();
    await target.backup.import(exported, 'merge');
    const again = await target.backup.import(exported, 'merge');
    expect(again).toMatchObject({ plantsAdded: 0, plantsUpdated: 0, plantsKept: 2, eventsAdded: 0 });
    expect(await target.db.plants.count()).toBe(2);
    expect(await target.db.events.count()).toBe(1);
  });

  it('merge keeps the more recently edited plant', async () => {
    const source = await seeded();
    const exported = await source.backup.export();
    const target = fresh();
    await target.backup.import(exported, 'merge');
    const newer = clone(exported);
    newer.plants[0]!.name = 'Renamed';
    newer.plants[0]!.updatedAt += 10_000;
    const summary = await target.backup.import(newer, 'merge');
    expect(summary.plantsUpdated).toBe(1);
    expect((await target.plants.get(newer.plants[0]!.id))?.name).toBe('Renamed');

    const older = clone(exported);
    older.plants[0]!.name = 'Stale';
    await target.backup.import(older, 'merge');
    expect((await target.plants.get(older.plants[0]!.id))?.name).toBe('Renamed');
  });

  it('recomputes cached last-watered times instead of trusting the file', async () => {
    const source = await seeded();
    const exported = clone(await source.backup.export());
    exported.plants.find((p) => p.id === source.a.id)!.lastWateredAt = 1;
    const target = fresh();
    await target.backup.import(exported, 'replace');
    expect((await target.plants.get(source.a.id))?.lastWateredAt).toBe(source.watered.at);
    expect((await target.plants.get(source.b.id))?.lastWateredAt).toBeNull();
  });

  it('leaves existing data untouched when an import fails', async () => {
    const source = await seeded();
    const exported = clone(await source.backup.export());
    const target = fresh();
    await target.plants.create({ name: 'Keep' });
    // Photo data that cannot be decoded makes the import throw before or inside the transaction.
    exported.photos.push({
      plantId: exported.plants[0]!.id,
      mime: 'image/png',
      width: 1,
      height: 1,
      updatedAt: 1,
      data: '***',
    });
    await expect(target.backup.import(exported, 'replace')).rejects.toBeDefined();
    expect((await target.plants.list()).map((p) => p.name)).toEqual(['Keep']);
  });
});

describe('demo repository', () => {
  it('loads labelled sample plants and removes only them', async () => {
    const { demo, plants, events } = fresh();
    const real = await plants.create({ name: 'Real' });
    await events.record({ plantId: real.id, task: 'water', kind: 'done' });

    const loaded = await demo.load();
    expect(loaded.map((p) => p.name)).toEqual([...DEMO_NAMES]);
    expect(loaded.every((p) => p.demo === true)).toBe(true);
    expect(await demo.count()).toBe(3);

    await events.record({ plantId: loaded[0]!.id, task: 'water', kind: 'done' });

    expect(await demo.remove()).toBe(3);
    expect(await demo.count()).toBe(0);
    expect((await plants.list()).map((p) => p.name)).toEqual(['Real']);
    expect(await events.listForPlant(real.id)).toHaveLength(1);
    expect(await events.listForPlant(loaded[0]!.id)).toHaveLength(0);
  });

  it('marks demo intervals as non-user values', async () => {
    const { demo } = fresh();
    const [first] = await demo.load();
    const water = first!.care.spring.water;
    expect(water.mode).toBe('interval');
    if (water.mode === 'interval') expect(water.source).toBe('default');
  });
});

describe('createMany', () => {
  it('adds all plants with distinct unguessable ids', async () => {
    const { plants } = fresh();
    const created = await plants.createMany([{ name: 'X' }, { name: 'Y' }, { name: 'Z' }]);
    expect(new Set(created.map((p) => p.id)).size).toBe(3);
    expect(created.every((p) => /^[A-Za-z0-9_-]{22}$/.test(p.id))).toBe(true);
    expect(await plants.list()).toHaveLength(3);
  });

  it('adds nothing when any input is invalid', async () => {
    const { plants } = fresh();
    await expect(plants.createMany([{ name: 'Fine' }, { name: '' }])).rejects.toBeDefined();
    expect(await plants.list()).toHaveLength(0);
  });
});
