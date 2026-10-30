import Dexie from 'dexie';
import { PotlyDb } from './db';
import { createEventsRepo } from './events';
import { createPhotosRepo } from './photo';
import { createPlantsRepo } from './plants';

let counter = 0;
function fresh(start = Date.parse('2025-07-01T08:30:00Z')) {
  const db = new PotlyDb(`events-test-${counter++}-${Math.random()}`);
  let t = start;
  const clock = () => (t += 1000);
  return { db, clock, plants: createPlantsRepo(db, clock), events: createEventsRepo(db, clock) };
}

describe('events repository', () => {
  it('records an event with season and updates plant caches', async () => {
    const { plants, events } = fresh();
    const p = await plants.create({ name: 'A' });
    const e = await events.record({ plantId: p.id, task: 'water', kind: 'done' });
    expect(e.seasonAtTime).toBe('summer');
    const after = await plants.get(p.id);
    expect(after?.lastWateredAt).toBe(e.at);
    expect(after?.lastSoilCheckAt).toBe(e.at);
    expect(after?.lastFertilizedAt).toBeNull();
  });

  it('checked_moist updates the soil check but not the last watering', async () => {
    const { plants, events } = fresh();
    const p = await plants.create({ name: 'A' });
    const e = await events.record({ plantId: p.id, task: 'water', kind: 'checked_moist' });
    const after = await plants.get(p.id);
    expect(after?.lastSoilCheckAt).toBe(e.at);
    expect(after?.lastWateredAt).toBeNull();
  });

  it('rejects an unknown plant and invalid combinations', async () => {
    const { plants, events } = fresh();
    await expect(events.record({ plantId: 'nope', task: 'water', kind: 'done' })).rejects.toThrow();
    const p = await plants.create({ name: 'A' });
    await expect(events.record({ plantId: p.id, task: 'fertilize', kind: 'checked_moist' })).rejects.toThrow();
    await expect(events.record({ plantId: p.id, task: 'water', kind: 'snoozed' })).rejects.toThrow();
  });

  it('undo appends a marker, keeps the original, and rewinds caches', async () => {
    const { db, plants, events } = fresh();
    const p = await plants.create({ name: 'A' });
    const first = await events.record({ plantId: p.id, task: 'water', kind: 'done' });
    const second = await events.record({ plantId: p.id, task: 'water', kind: 'done' });
    const marker = await events.undo(second.id);

    expect(marker.kind).toBe('undo');
    expect(marker.undoesId).toBe(second.id);
    expect(await db.events.count()).toBe(3);
    expect(await db.events.get(second.id)).toEqual(second);
    expect((await plants.get(p.id))?.lastWateredAt).toBe(first.at);

    await expect(events.undo(second.id)).rejects.toThrow('Already undone');
    await expect(events.undo(marker.id)).rejects.toThrow('Cannot undo an undo');
    await expect(events.undo('missing')).rejects.toThrow();
  });

  it('snooze stores the target Tehran day', async () => {
    const { plants, events } = fresh(Date.parse('2025-06-30T20:00:00Z'));
    const p = await plants.create({ name: 'A' });
    const e = await events.snooze(p.id, 'water', 1);
    // clock ≈ 20:00:02Z = 23:30 Tehran on 06-30 → +1 day = 07-01
    expect(e.kind).toBe('snoozed');
    expect(e.snoozeUntilDay).toBe('2025-07-01');
  });

  it('recordMany is atomic: one bad plant means nothing is written', async () => {
    const { db, plants, events } = fresh();
    const a = await plants.create({ name: 'A' });
    const b = await plants.create({ name: 'B' });
    await expect(
      events.recordMany(
        [
          { plantId: a.id, task: 'water' },
          { plantId: 'ghost', task: 'water' },
          { plantId: b.id, task: 'water' },
        ],
        { kind: 'done' },
      ),
    ).rejects.toThrow();
    expect(await db.events.count()).toBe(0);
    expect((await plants.get(a.id))?.lastWateredAt).toBeNull();

    const ok = await events.recordMany(
      [
        { plantId: a.id, task: 'water' },
        { plantId: b.id, task: 'fertilize' },
      ],
      { kind: 'done' },
    );
    expect(ok).toHaveLength(2);
    expect((await plants.get(b.id))?.lastFertilizedAt).not.toBeNull();
  });

  it('lists history newest first', async () => {
    const { plants, events } = fresh();
    const p = await plants.create({ name: 'A' });
    const e1 = await events.record({ plantId: p.id, task: 'water', kind: 'done' });
    const e2 = await events.record({ plantId: p.id, task: 'fertilize', kind: 'done' });
    expect((await events.listForPlant(p.id)).map((e) => e.id)).toEqual([e2.id, e1.id]);
  });
});

describe('plants repository — archive and delete', () => {
  it('archive hides from list but keeps data; unarchive restores', async () => {
    const { plants, events } = fresh();
    const p = await plants.create({ name: 'A' });
    await events.record({ plantId: p.id, task: 'water', kind: 'done' });
    await plants.archive(p.id);
    expect(await plants.list()).toHaveLength(0);
    expect((await plants.listArchived()).map((x) => x.id)).toEqual([p.id]);
    expect(await events.listForPlant(p.id)).toHaveLength(1);
    await plants.unarchive(p.id);
    expect((await plants.list()).map((x) => x.id)).toEqual([p.id]);
    await expect(plants.archive('missing')).rejects.toThrow();
  });

  it('remove cascades to events and photo, and leaves other plants alone', async () => {
    const { db, clock, plants, events } = fresh();
    const photos = createPhotosRepo(db, clock);
    const a = await plants.create({ name: 'A' });
    const b = await plants.create({ name: 'B' });
    await events.record({ plantId: a.id, task: 'water', kind: 'done' });
    await events.record({ plantId: b.id, task: 'water', kind: 'done' });
    await db.photos.put({ plantId: a.id, blob: new Blob(['x']), mimeType: 'image/jpeg', width: 1, height: 1, updatedAt: 1 } as never);
    await plants.remove(a.id);
    expect(await plants.get(a.id)).toBeUndefined();
    expect(await db.events.where('plantId').equals(a.id).count()).toBe(0);
    expect(await photos.get(a.id)).toBeUndefined();
    expect(await db.events.where('plantId').equals(b.id).count()).toBe(1);
  });
});

describe('database upgrade v1 → v2', () => {
  it('adds the events table and backfills plant cache fields', async () => {
    const name = `upgrade-${counter++}-${Math.random()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ plants: 'id, name, room, archivedAt, createdAt', photos: 'plantId' });
    await v1.table('plants').add({ id: 'old', name: 'قدیمی', archivedAt: null, createdAt: 1 });
    v1.close();

    const v2 = new PotlyDb(name);
    const upgraded = await v2.plants.get('old');
    expect(upgraded).toMatchObject({ name: 'قدیمی', lastWateredAt: null, lastSoilCheckAt: null, lastFertilizedAt: null });
    expect(await v2.events.count()).toBe(0);
    v2.close();
  });
});
