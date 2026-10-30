import { buildPlant } from '../domain/defaults';
import { newId } from '../domain/id';
import {
  plantPatchSchema,
  plantSchema,
  type Plant,
  type PlantInput,
  type PlantPatch,
} from '../domain/schemas';
import { db as defaultDb, type PotlyDb } from './db';

export function createPlantsRepo(db: PotlyDb = defaultDb, clock: () => number = Date.now) {
  return {
    async create(input: PlantInput): Promise<Plant> {
      const plant = buildPlant(newId(), input, clock());
      plantSchema.parse(plant);
      await db.plants.add(plant);
      return plant;
    },

    async get(id: string): Promise<Plant | undefined> {
      return db.plants.get(id);
    },

    async list(): Promise<Plant[]> {
      const all = await db.plants.toArray();
      return all.filter((p) => p.archivedAt === null).sort((a, b) => a.createdAt - b.createdAt);
    },

    async update(id: string, patch: PlantPatch): Promise<Plant> {
      const existing = await db.plants.get(id);
      if (!existing) throw new Error(`Plant not found: ${id}`);
      const parsed = plantPatchSchema.parse({
        ...patch,
        ...('species' in patch ? { species: patch.species?.trim() || null } : {}),
        ...('room' in patch ? { room: patch.room?.trim() || null } : {}),
      });
      const next: Plant = { ...existing, ...stripUndefined(parsed), updatedAt: clock() };
      plantSchema.parse(next);
      await db.plants.put(next);
      return next;
    },
  };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export const plantsRepo = createPlantsRepo();
