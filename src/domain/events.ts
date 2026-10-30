import { z } from 'zod';
import { DAY_KEY_PATTERN } from './dayKey';
import { plantSchema, seasonSchema } from './schemas';

export const TASKS = ['water', 'fertilize'] as const;
export const taskSchema = z.enum(TASKS);
export type Task = z.infer<typeof taskSchema>;

export const EVENT_KINDS = ['done', 'skipped', 'snoozed', 'checked_moist', 'undo'] as const;
export const eventKindSchema = z.enum(EVENT_KINDS);
export type EventKind = z.infer<typeof eventKindSchema>;

/** Append-only. An `undo` event cancels another event without deleting or editing it. */
export const careEventSchema = z
  .object({
    id: plantSchema.shape.id,
    plantId: plantSchema.shape.id,
    task: taskSchema,
    kind: eventKindSchema,
    at: z.number().int(),
    seasonAtTime: seasonSchema,
    snoozeUntilDay: z.string().regex(DAY_KEY_PATTERN).nullable(),
    undoesId: plantSchema.shape.id.nullable(),
    note: z.string().max(1000),
  })
  .superRefine((e, ctx) => {
    if (e.kind === 'snoozed' && !e.snoozeUntilDay) {
      ctx.addIssue({ code: 'custom', message: 'snoozed needs snoozeUntilDay', path: ['snoozeUntilDay'] });
    }
    if (e.kind === 'undo' && !e.undoesId) {
      ctx.addIssue({ code: 'custom', message: 'undo needs undoesId', path: ['undoesId'] });
    }
    if (e.kind === 'checked_moist' && e.task !== 'water') {
      ctx.addIssue({ code: 'custom', message: 'checked_moist only applies to water', path: ['kind'] });
    }
  });
export type CareEvent = z.infer<typeof careEventSchema>;

export interface RecordInput {
  plantId: string;
  task: Task;
  kind: EventKind;
  snoozeUntilDay?: string | null;
  undoesId?: string | null;
  note?: string;
}

export function undoneIds(events: readonly CareEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const e of events) if (e.kind === 'undo' && e.undoesId) ids.add(e.undoesId);
  return ids;
}

/** Events that count: not undo markers and not cancelled by one. Order preserved. */
export function effectiveEvents(events: readonly CareEvent[]): CareEvent[] {
  const undone = undoneIds(events);
  return events.filter((e) => e.kind !== 'undo' && !undone.has(e.id));
}

export interface CareCaches {
  lastWateredAt: number | null;
  lastSoilCheckAt: number | null;
  lastFertilizedAt: number | null;
}

/** Plant `last*At` fields are caches rebuilt from events. */
export function deriveCaches(events: readonly CareEvent[]): CareCaches {
  const caches: CareCaches = { lastWateredAt: null, lastSoilCheckAt: null, lastFertilizedAt: null };
  const bump = (current: number | null, at: number) => (current === null || at > current ? at : current);
  for (const e of effectiveEvents(events)) {
    if (e.task === 'water' && e.kind === 'done') {
      caches.lastWateredAt = bump(caches.lastWateredAt, e.at);
      caches.lastSoilCheckAt = bump(caches.lastSoilCheckAt, e.at);
    } else if (e.task === 'water' && e.kind === 'checked_moist') {
      caches.lastSoilCheckAt = bump(caches.lastSoilCheckAt, e.at);
    } else if (e.task === 'fertilize' && e.kind === 'done') {
      caches.lastFertilizedAt = bump(caches.lastFertilizedAt, e.at);
    }
  }
  return caches;
}
