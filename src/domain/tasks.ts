import { addDays, dayKey, diffDays } from './dayKey';
import { effectiveEvents, TASKS, type CareEvent, type Task } from './events';
import { seasonFor, type Calendar } from './season';
import type { Plant, Season } from './schemas';

export interface ScheduleSettings {
  timeZone: string;
  calendar: Calendar;
  /** Days until the next soil check after "checked, still moist". */
  checkedMoistGapDays: number;
}

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  timeZone: 'Asia/Tehran',
  calendar: 'persian',
  checkedMoistGapDays: 2,
};

export interface DueTask {
  plantId: string;
  task: Task;
  season: Season;
  status: 'overdue' | 'today' | 'upcoming';
  dueDay: string;
  daysOverdue: number;
  everyDays: number;
}

/**
 * Which tasks are due for each plant, given history. `unknown`/`inactive` settings produce nothing.
 * Anchor = latest done / checked_moist / skipped event; no anchor falls back to the creation day.
 * A snooze made after the anchor hides the task until its `snoozeUntilDay`.
 */
export function computeTasks(
  plants: readonly Plant[],
  events: readonly CareEvent[],
  now: number,
  settings: ScheduleSettings = DEFAULT_SCHEDULE_SETTINGS,
): DueTask[] {
  const today = dayKey(now, settings.timeZone);
  const season = seasonFor(now, settings.timeZone, settings.calendar);
  const live = effectiveEvents(events);
  const byPlant = new Map<string, CareEvent[]>();
  for (const e of [...live].sort((a, b) => a.at - b.at)) {
    const list = byPlant.get(e.plantId);
    if (list) list.push(e);
    else byPlant.set(e.plantId, [e]);
  }

  const out: DueTask[] = [];
  for (const plant of plants) {
    if (plant.archivedAt !== null) continue;
    for (const task of TASKS) {
      const setting = plant.care[season][task];
      if (setting.mode !== 'interval') continue;

      const history = (byPlant.get(plant.id) ?? []).filter((e) => e.task === task);
      let anchor: CareEvent | undefined;
      let anchorIndex = -1;
      for (const [i, e] of history.entries()) {
        if (e.kind === 'done' || e.kind === 'checked_moist' || e.kind === 'skipped') {
          anchor = e;
          anchorIndex = i;
        }
      }

      let dueDay: string;
      if (!anchor) dueDay = addDays(dayKey(plant.createdAt, settings.timeZone), setting.everyDays);
      else {
        const gap = anchor.kind === 'checked_moist' ? settings.checkedMoistGapDays : setting.everyDays;
        dueDay = addDays(dayKey(anchor.at, settings.timeZone), gap);
      }

      let snoozedUntil: string | null = null;
      for (const [i, e] of history.entries()) {
        if (e.kind === 'snoozed' && i > anchorIndex) snoozedUntil = e.snoozeUntilDay;
      }
      if (snoozedUntil && today < snoozedUntil) continue;

      const delta = diffDays(today, dueDay);
      out.push({
        plantId: plant.id,
        task,
        season,
        status: delta < 0 ? 'overdue' : delta === 0 ? 'today' : 'upcoming',
        dueDay,
        daysOverdue: Math.max(0, -delta),
        everyDays: setting.everyDays,
      });
    }
  }
  return out;
}
