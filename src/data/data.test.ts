import { PotlyDb } from './db';
import { createPhotosRepo, MAX_PHOTO_EDGE, scaledSize } from './photo';
import { createPlantsRepo } from './plants';

let counter = 0;
function freshRepos() {
  const db = new PotlyDb(`test-${counter++}-${Math.random()}`);
  let t = 1000;
  const clock = () => ++t;
  return { db, plants: createPlantsRepo(db, clock), photos: createPhotosRepo(db, clock) };
}

describe('plants repository', () => {
  it('creates a name-only plant and reads it back', async () => {
    const { plants } = freshRepos();
    const created = await plants.create({ name: 'Ficus' });
    const found = await plants.get(created.id);
    expect(found).toEqual(created);
    expect(found?.light).toBe('unknown');
  });

  it('persists across a new connection to the same database', async () => {
    const { db, plants } = freshRepos();
    const created = await plants.create({ name: 'Aloe' });
    db.close();
    const reopened = new PotlyDb(db.name);
    const again = await createPlantsRepo(reopened).list();
    expect(again.map((p) => p.id)).toEqual([created.id]);
    reopened.close();
  });

  it('lists in creation order and hides archived plants', async () => {
    const { db, plants } = freshRepos();
    const a = await plants.create({ name: 'A' });
    const b = await plants.create({ name: 'B' });
    await db.plants.update(a.id, { archivedAt: 5 });
    expect((await plants.list()).map((p) => p.id)).toEqual([b.id]);
  });

  it('updates fields, bumps updatedAt, keeps id and createdAt', async () => {
    const { plants } = freshRepos();
    const created = await plants.create({ name: 'Old' });
    const updated = await plants.update(created.id, { name: 'New', room: 'Kitchen', potSizeCm: 14 });
    expect(updated.name).toBe('New');
    expect(updated.room).toBe('Kitchen');
    expect(updated.potSizeCm).toBe(14);
    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(await plants.get(created.id)).toEqual(updated);
  });

  it('clears optional text when patched to blank', async () => {
    const { plants } = freshRepos();
    const created = await plants.create({ name: 'x', species: 'Ficus' });
    const updated = await plants.update(created.id, { species: '' });
    expect(updated.species).toBeNull();
  });

  it('does not touch untouched fields on partial patch', async () => {
    const { plants } = freshRepos();
    const created = await plants.create({ name: 'x', notes: 'keep me' });
    const updated = await plants.update(created.id, { name: 'y' });
    expect(updated.notes).toBe('keep me');
  });

  it('rejects invalid input without writing', async () => {
    const { plants } = freshRepos();
    await expect(plants.create({ name: '   ' })).rejects.toThrow();
    expect(await plants.list()).toHaveLength(0);
    const created = await plants.create({ name: 'ok' });
    await expect(plants.update(created.id, { name: '' })).rejects.toThrow();
    expect((await plants.get(created.id))?.name).toBe('ok');
  });

  it('throws when updating an unknown id', async () => {
    const { plants } = freshRepos();
    await expect(plants.update('A'.repeat(22), { name: 'x' })).rejects.toThrow();
  });
});

describe('photos', () => {
  it('stores, reads and removes a photo', async () => {
    const { photos } = freshRepos();
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await photos.set('p1', blob, 10, 20);
    const got = await photos.get('p1');
    expect(got?.width).toBe(10);
    expect(got?.height).toBe(20);
    await photos.remove('p1');
    expect(await photos.get('p1')).toBeUndefined();
  });

  it('scaledSize keeps small images and shrinks large ones proportionally', () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
    const big = scaledSize(4000, 3000);
    expect(big).toEqual({ width: MAX_PHOTO_EDGE, height: 768 });
    expect(scaledSize(3000, 4000)).toEqual({ width: 768, height: MAX_PHOTO_EDGE });
  });
});
