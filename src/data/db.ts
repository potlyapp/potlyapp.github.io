import Dexie, { type EntityTable } from 'dexie';
import type { CareEvent } from '../domain/events';
import type { Photo, Plant } from '../domain/schemas';

export class PotlyDb extends Dexie {
  plants!: EntityTable<Plant, 'id'>;
  photos!: EntityTable<Photo, 'plantId'>;
  events!: EntityTable<CareEvent, 'id'>;

  constructor(name = 'potly') {
    super(name);
    this.version(1).stores({
      plants: 'id, name, room, archivedAt, createdAt',
      photos: 'plantId',
    });
    this.version(2)
      .stores({
        plants: 'id, name, room, archivedAt, createdAt',
        photos: 'plantId',
        events: 'id, plantId, at, [plantId+at]',
      })
      .upgrade((tx) =>
        tx
          .table('plants')
          .toCollection()
          .modify((p: Partial<Plant>) => {
            p.lastWateredAt ??= null;
            p.lastSoilCheckAt ??= null;
            p.lastFertilizedAt ??= null;
          }),
      );
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
