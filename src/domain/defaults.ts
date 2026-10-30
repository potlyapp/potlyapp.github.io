import { SCHEMA_VERSION, type CareSettings, type Plant, type PlantInput, plantInputSchema } from './schemas';

export function unknownCare(): CareSettings {
  const season = () => ({
    water: { mode: 'unknown' as const, source: 'default' as const },
    fertilize: { mode: 'unknown' as const, source: 'default' as const },
  });
  return { spring: season(), summer: season(), autumn: season(), winter: season() };
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildPlant(id: string, input: PlantInput, now: number): Plant {
  const parsed = plantInputSchema.parse({
    ...input,
    species: emptyToNull(input.species),
    room: emptyToNull(input.room),
  });
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    name: parsed.name,
    species: parsed.species ?? null,
    room: parsed.room ?? null,
    light: parsed.light ?? 'unknown',
    potMaterial: parsed.potMaterial ?? 'unknown',
    potSizeCm: parsed.potSizeCm ?? null,
    soil: parsed.soil ?? 'unknown',
    notes: parsed.notes ?? '',
    care: unknownCare(),
    lastWateredAt: null,
    lastSoilCheckAt: null,
    lastFertilizedAt: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
}
