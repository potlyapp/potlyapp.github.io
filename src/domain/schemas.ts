import { z } from 'zod';

export const SCHEMA_VERSION = 1;

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const seasonSchema = z.enum(SEASONS);
export type Season = z.infer<typeof seasonSchema>;

export const sourceSchema = z.enum(['user', 'default', 'suggested']);
export type Source = z.infer<typeof sourceSchema>;

const taskSettingSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('unknown'), source: sourceSchema, sourceNote: z.string().optional() }),
  z.object({ mode: z.literal('inactive'), source: sourceSchema, sourceNote: z.string().optional() }),
  z.object({
    mode: z.literal('interval'),
    everyDays: z.number().int().min(1).max(365),
    source: sourceSchema,
    sourceNote: z.string().optional(),
  }),
]);
export type TaskSetting = z.infer<typeof taskSettingSchema>;

const seasonCareSchema = z.object({
  water: taskSettingSchema,
  fertilize: taskSettingSchema,
});
export type SeasonCare = z.infer<typeof seasonCareSchema>;

export const careSettingsSchema = z.object({
  spring: seasonCareSchema,
  summer: seasonCareSchema,
  autumn: seasonCareSchema,
  winter: seasonCareSchema,
});
export type CareSettings = z.infer<typeof careSettingsSchema>;

export const LIGHT_VALUES = ['unknown', 'low', 'medium', 'bright', 'direct'] as const;
export const POT_MATERIAL_VALUES = ['unknown', 'plastic', 'terracotta', 'ceramic', 'other'] as const;
export const SOIL_VALUES = ['unknown', 'standard', 'well_draining', 'moisture_retaining', 'other'] as const;

export const plantSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  schemaVersion: z.literal(SCHEMA_VERSION),
  name: z.string().trim().min(1).max(100),
  species: z.string().trim().max(100).nullable(),
  room: z.string().trim().max(60).nullable(),
  light: z.enum(LIGHT_VALUES),
  potMaterial: z.enum(POT_MATERIAL_VALUES),
  potSizeCm: z.number().positive().max(200).nullable(),
  soil: z.enum(SOIL_VALUES),
  notes: z.string().max(5000),
  care: careSettingsSchema,
  lastWateredAt: z.number().int().nullable(),
  lastSoilCheckAt: z.number().int().nullable(),
  lastFertilizedAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  archivedAt: z.number().int().nullable(),
});
export type Plant = z.infer<typeof plantSchema>;
export type Light = Plant['light'];
export type PotMaterial = Plant['potMaterial'];
export type Soil = Plant['soil'];

export const plantInputSchema = z.object({
  name: plantSchema.shape.name,
  species: plantSchema.shape.species.optional(),
  room: plantSchema.shape.room.optional(),
  light: plantSchema.shape.light.optional(),
  potMaterial: plantSchema.shape.potMaterial.optional(),
  potSizeCm: plantSchema.shape.potSizeCm.optional(),
  soil: plantSchema.shape.soil.optional(),
  notes: plantSchema.shape.notes.optional(),
});
export type PlantInput = z.input<typeof plantInputSchema>;

export const plantPatchSchema = plantInputSchema.partial();
export type PlantPatch = z.input<typeof plantPatchSchema>;

export const photoSchema = z.object({
  plantId: plantSchema.shape.id,
  blob: z.instanceof(Blob),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  updatedAt: z.number().int(),
});
export type Photo = z.infer<typeof photoSchema>;
