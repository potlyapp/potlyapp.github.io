import { addDays, dayKey } from '../domain/dayKey';
import {
  careEventSchema,
  deriveCaches,
  undoneIds,
  type CareEvent,
  type RecordInput,
  type Task,
} from '../domain/events';
import { newId } from '../domain/id';
import { seasonFor } from '../domain/season';
import { DEFAULT_SCHEDULE_SETTINGS, type ScheduleSettings } from '../domain/tasks';
import { db as defaultDb, type PotlyDb } from './db';

export function createEventsRepo(
  db: PotlyDb = defaultDb,
  clock: () => number = Date.now,
  getSettings: () => ScheduleSettings = () => DEFAULT_SCHEDULE_SETTINGS,
) {
  async function refreshCaches(plantId: string): Promise<void> {
    const events = await db.events.where('plantId').equals(plantId).toArray();
    await db.plants.update(plantId, deriveCaches(events));
  }

  async function append(input: RecordInput): Promise<CareEvent> {
    const settings = getSettings();
    const at = clock();
    const event = careEventSchema.parse({
      id: newId(),
      plantId: input.plantId,
      task: input.task,
      kind: input.kind,
      at,
      seasonAtTime: seasonFor(at, settings.timeZone, settings.calendar),
      snoozeUntilDay: input.snoozeUntilDay ?? null,
      undoesId: input.undoesId ?? null,
      note: input.note ?? '',
    });
    await db.events.add(event);
    await refreshCaches(input.plantId);
    return event;
  }

  return {
    /** Append one event. Events are never edited or deleted (except with the whole plant). */
    async record(input: RecordInput): Promise<CareEvent> {
      return db.transaction('rw', db.events, db.plants, async () => {
        if (!(await db.plants.get(input.plantId))) throw new Error(`Plant not found: ${input.plantId}`);
        return append(input);
      });
    },

    /** Same action for several plant/task pairs in one transaction: all recorded or none. */
    async recordMany(
      items: ReadonlyArray<{ plantId: string; task: Task }>,
      input: Omit<RecordInput, 'plantId' | 'task'>,
    ): Promise<CareEvent[]> {
      return db.transaction('rw', db.events, db.plants, async () => {
        const out: CareEvent[] = [];
        for (const item of items) {
          if (!(await db.plants.get(item.plantId))) throw new Error(`Plant not found: ${item.plantId}`);
          out.push(await append({ ...input, ...item }));
        }
        return out;
      });
    },

    async snooze(plantId: string, task: Task, days: number): Promise<CareEvent> {
      const settings = getSettings();
      const until = addDays(dayKey(clock(), settings.timeZone), days);
      return this.record({ plantId, task, kind: 'snoozed', snoozeUntilDay: until });
    },

    /** Cancels an event by appending an `undo` marker; the original stays in history. */
    async undo(eventId: string): Promise<CareEvent> {
      return db.transaction('rw', db.events, db.plants, async () => {
        const target = await db.events.get(eventId);
        if (!target) throw new Error(`Event not found: ${eventId}`);
        if (target.kind === 'undo') throw new Error('Cannot undo an undo');
        const existing = await db.events.where('plantId').equals(target.plantId).toArray();
        if (undoneIds(existing).has(eventId)) throw new Error('Already undone');
        return append({ plantId: target.plantId, task: target.task, kind: 'undo', undoesId: eventId });
      });
    },

    /** Full history for one plant, newest first, including undo markers. */
    async listForPlant(plantId: string): Promise<CareEvent[]> {
      const events = await db.events.where('plantId').equals(plantId).toArray();
      return events.sort((a, b) => b.at - a.at);
    },

    async listAll(): Promise<CareEvent[]> {
      return db.events.toArray();
    },
  };
}

export const eventsRepo = createEventsRepo();
