import Dexie, { type EntityTable } from 'dexie';
import type { Photo, Plant } from '../domain/schemas';

export class PotlyDb extends Dexie {
  plants!: EntityTable<Plant, 'id'>;
  photos!: EntityTable<Photo, 'plantId'>;

  constructor(name = 'potly') {
    super(name);
    // Later phases add versions (e.g. v2 adds `events`) with upgrade() hooks.
    this.version(1).stores({
      plants: 'id, name, room, archivedAt, createdAt',
      photos: 'plantId',
    });
  }
}

export const db = new PotlyDb();

export async function checkStorage(target: PotlyDb = db): Promise<boolean> {
  try {
    await target.open();
    return true;
  } catch {
    return false;
  }
}
