import { buildPlant, unknownCare } from '../domain/defaults';
import { newId } from '../domain/id';
import { SEASONS, plantSchema, type CareSettings, type Plant } from '../domain/schemas';
import { db as defaultDb, type PotlyDb } from './db';

/** Names are deliberately generic: no species, so no care advice is implied. */
export const DEMO_NAMES = ['گیاه نمونه ۱', 'گیاه نمونه ۲', 'گیاه نمونه ۳'] as const;

const DAY_MS = 86_400_000;

function withWaterInterval(days: number): CareSettings {
  const care = unknownCare();
  for (const season of SEASONS) {
    care[season].water = { mode: 'interval', everyDays: days, source: 'default', sourceNote: 'demo' };
  }
  return care;
}

export function createDemoRepo(db: PotlyDb = defaultDb, clock: () => number = Date.now) {
  return {
    async count(): Promise<number> {
      return (await db.plants.toArray()).filter((p) => p.demo === true).length;
    },

    /** Adds labelled sample plants. Intervals are placeholders for trying the app, not care advice. */
    async load(): Promise<Plant[]> {
      const now = clock();
      const created = now - 10 * DAY_MS;
      const plants: Plant[] = DEMO_NAMES.map((name, i) => {
        const base = buildPlant(newId(), { name, room: 'نمونه' }, created + i);
        const plant: Plant = { ...base, demo: true };
        if (i === 0) plant.care = withWaterInterval(3);
        if (i === 1) plant.care = withWaterInterval(21);
        return plantSchema.parse(plant);
      });
      await db.plants.bulkAdd(plants);
      return plants;
    },

    /** One action removes every sample plant with its history and photo. Real plants are untouched. */
    async remove(): Promise<number> {
      const ids = (await db.plants.toArray()).filter((p) => p.demo === true).map((p) => p.id);
      await db.transaction('rw', db.plants, db.photos, db.events, async () => {
        await db.events.where('plantId').anyOf(ids).delete();
        await db.photos.bulkDelete(ids);
        await db.plants.bulkDelete(ids);
      });
      return ids.length;
    },
  };
}

export const demoRepo = createDemoRepo();
