import Dexie, { type EntityTable } from 'dexie';
import type { CareEvent } from '../domain/events';
import type { Photo, Plant } from '../domain/schemas';
import type { AppSettings } from '../domain/settings';

export type SettingsRow = AppSettings & { key: string };

export class PotlyDb extends Dexie {
  plants!: EntityTable<Plant, 'id'>;
  photos!: EntityTable<Photo, 'plantId'>;
  events!: EntityTable<CareEvent, 'id'>;
  settings!: EntityTable<SettingsRow, 'key'>;

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
    this.version(3).stores({
      plants: 'id, name, room, archivedAt, createdAt',
      photos: 'plantId',
      events: 'id, plantId, at, [plantId+at]',
      settings: 'key',
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
