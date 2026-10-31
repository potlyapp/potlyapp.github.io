import { buildPlant } from './defaults';
import type { CareEvent } from './events';
import type { Plant, Season } from './schemas';
import { computeTasks, type ScheduleSettings } from './tasks';

const at = (iso: string) => Date.parse(iso);
type Setting = Plant['care']['spring']['water'];
const every = (n: number): Setting => ({ mode: 'interval', everyDays: n, source: 'user' });

function ev(partial: Partial<CareEvent> & Pick<CareEvent, 'id' | 'kind' | 'at'>): CareEvent {
  return {
    plantId: 'P1',
    task: 'water',
    seasonAtTime: 'summer',
    snoozeUntilDay: null,
    undoesId: null,
    note: '',
    ...partial,
  };
}

function plant(care: Partial<Record<Season, Setting>>, createdAt = at('2025-06-01T08:30:00Z'), fertilize?: Setting): Plant {
  const p = buildPlant('P1', { name: 'P1' }, createdAt);
  for (const [season, setting] of Object.entries(care) as Array<[Season, Setting]>) p.care[season].water = setting;
  if (fertilize) for (const season of Object.keys(p.care) as Season[]) p.care[season].fertilize = fertilize;
  return p;
}

const first = (p: Plant, events: CareEvent[], now: number, settings?: ScheduleSettings) =>
  computeTasks([p], events, now, settings).find((t) => t.task === 'water');

// Tehran day 2025-07-01 noon, summer.
const NOW = at('2025-07-01T08:30:00Z');

describe('nextDue — skipped', () => {
  it('a skip anchors the next due day exactly like a done', () => {
    const p = plant({ summer: every(5) });
    const skipped = ev({ id: 's', kind: 'skipped', at: at('2025-06-28T08:30:00Z') });
    const done = ev({ id: 'd', kind: 'done', at: at('2025-06-28T08:30:00Z') });
    expect(first(p, [skipped], NOW)?.dueDay).toBe(first(p, [done], NOW)?.dueDay);
    expect(first(p, [skipped], NOW)?.dueDay).toBe('2025-07-03');
  });

  it('a later skip replaces an earlier done as the anchor', () => {
    const p = plant({ summer: every(5) });
    const done = ev({ id: 'd', kind: 'done', at: at('2025-06-20T08:30:00Z') });
    const skipped = ev({ id: 's', kind: 'skipped', at: at('2025-06-30T08:30:00Z') });
    expect(first(p, [done, skipped], NOW)).toMatchObject({ dueDay: '2025-07-05', status: 'upcoming' });
  });

  it('an undone skip falls back to the previous anchor', () => {
    const p = plant({ summer: every(5) });
    const done = ev({ id: 'd', kind: 'done', at: at('2025-06-20T08:30:00Z') });
    const skipped = ev({ id: 's', kind: 'skipped', at: at('2025-06-30T08:30:00Z') });
    const undo = ev({ id: 'u', kind: 'undo', at: NOW, undoesId: 's' });
    expect(first(p, [done, skipped, undo], NOW)).toMatchObject({ dueDay: '2025-06-25', status: 'overdue' });
  });

  it('skip does not leak into the other task', () => {
    const p = plant({ summer: every(5) }, at('2025-06-01T08:30:00Z'), every(14));
    const skipWater = ev({ id: 's', kind: 'skipped', at: at('2025-06-30T08:30:00Z') });
    const fert = computeTasks([p], [skipWater], NOW).find((t) => t.task === 'fertilize');
    expect(fert?.dueDay).toBe('2025-06-15');
  });
});

describe('nextDue — checked_moist', () => {
  it('uses the configurable re-check gap', () => {
    const p = plant({ summer: every(10) });
    const checked = ev({ id: 'c', kind: 'checked_moist', at: at('2025-06-29T08:30:00Z') });
    expect(first(p, [checked], NOW, { timeZone: 'Asia/Tehran', calendar: 'persian', checkedMoistGapDays: 5 })).toMatchObject({
      dueDay: '2025-07-04',
      status: 'upcoming',
    });
    expect(first(p, [checked], NOW, { timeZone: 'Asia/Tehran', calendar: 'persian', checkedMoistGapDays: 1 })).toMatchObject({
      dueDay: '2025-06-30',
      status: 'overdue',
    });
  });

  it('a check made after a done wins; a done made after a check wins back the full interval', () => {
    const p = plant({ summer: every(10) });
    const done = ev({ id: 'd', kind: 'done', at: at('2025-06-25T08:30:00Z') });
    const checked = ev({ id: 'c', kind: 'checked_moist', at: at('2025-06-29T08:30:00Z') });
    expect(first(p, [done, checked], NOW)?.dueDay).toBe('2025-07-01');
    const watered = ev({ id: 'w', kind: 'done', at: at('2025-06-30T08:30:00Z') });
    expect(first(p, [done, checked, watered], NOW)?.dueDay).toBe('2025-07-10');
  });

  it('repeated checks keep pushing the task by the gap, never by the full interval', () => {
    const p = plant({ summer: every(30) });
    const c1 = ev({ id: 'c1', kind: 'checked_moist', at: at('2025-06-25T08:30:00Z') });
    const c2 = ev({ id: 'c2', kind: 'checked_moist', at: at('2025-06-27T08:30:00Z') });
    const c3 = ev({ id: 'c3', kind: 'checked_moist', at: at('2025-06-29T08:30:00Z') });
    expect(first(p, [c1, c2, c3], NOW)).toMatchObject({ dueDay: '2025-07-01', status: 'today' });
  });

  it('an undone check restores the earlier anchor', () => {
    const p = plant({ summer: every(10) });
    const done = ev({ id: 'd', kind: 'done', at: at('2025-06-25T08:30:00Z') });
    const checked = ev({ id: 'c', kind: 'checked_moist', at: at('2025-06-29T08:30:00Z') });
    const undo = ev({ id: 'u', kind: 'undo', at: NOW, undoesId: 'c' });
    expect(first(p, [done, checked, undo], NOW)?.dueDay).toBe('2025-07-05');
  });

  it('a check stays a short re-check even after the season changed', () => {
    const p = plant({ summer: every(10), autumn: every(14) });
    const checked = ev({ id: 'c', kind: 'checked_moist', at: at('2025-09-22T08:30:00Z'), seasonAtTime: 'summer' });
    expect(first(p, [checked], at('2025-09-23T08:30:00Z'))).toMatchObject({
      season: 'autumn',
      dueDay: '2025-09-24',
      everyDays: 14,
    });
  });
});

describe('nextDue — snoozed', () => {
  it('a snooze never moves the due day, it only hides the task', () => {
    const p = plant({ summer: every(7) });
    const done = ev({ id: 'd', kind: 'done', at: at('2025-06-20T08:30:00Z') });
    const snooze = ev({ id: 'z', kind: 'snoozed', at: NOW, snoozeUntilDay: '2025-07-04' });
    expect(first(p, [done, snooze], NOW)).toBeUndefined();
    const back = first(p, [done, snooze], at('2025-07-04T08:30:00Z'));
    expect(back).toMatchObject({ dueDay: '2025-06-27', status: 'overdue', daysOverdue: 7 });
  });

  it('is hidden through the last second of the snooze day before it, visible from Tehran midnight', () => {
    const p = plant({ summer: every(1) });
    const snooze = ev({ id: 'z', kind: 'snoozed', at: NOW, snoozeUntilDay: '2025-07-02' });
    expect(first(p, [snooze], at('2025-07-01T20:29:59Z'))).toBeUndefined();
    expect(first(p, [snooze], at('2025-07-01T20:30:00Z'))).toBeDefined();
  });

  it('snoozing a task that is not due yet is harmless', () => {
    const p = plant({ summer: every(30) });
    const snooze = ev({ id: 'z', kind: 'snoozed', at: NOW, snoozeUntilDay: '2025-07-03' });
    expect(first(p, [snooze], NOW)).toBeUndefined();
    expect(first(p, [snooze], at('2025-07-03T08:30:00Z'))).toMatchObject({ dueDay: '2025-07-01', status: 'overdue' });
  });

  it('the most recent snooze wins, even when it is shorter', () => {
    const p = plant({ summer: every(1) });
    const long = ev({ id: 'a', kind: 'snoozed', at: at('2025-06-30T08:30:00Z'), snoozeUntilDay: '2025-07-10' });
    const short = ev({ id: 'b', kind: 'snoozed', at: NOW, snoozeUntilDay: '2025-07-02' });
    expect(first(p, [long, short], at('2025-07-02T08:30:00Z'))).toBeDefined();
    expect(first(p, [long, short], NOW)).toBeUndefined();
  });

  it('an undone snooze shows the task again', () => {
    const p = plant({ summer: every(1) });
    const snooze = ev({ id: 'z', kind: 'snoozed', at: NOW, snoozeUntilDay: '2025-07-10' });
    const undo = ev({ id: 'u', kind: 'undo', at: NOW + 1000, undoesId: 'z' });
    expect(first(p, [snooze], NOW)).toBeUndefined();
    expect(first(p, [snooze, undo], NOW + 2000)).toBeDefined();
  });

  it('undoing a later snooze restores an earlier one', () => {
    const p = plant({ summer: every(1) });
    const a = ev({ id: 'a', kind: 'snoozed', at: at('2025-06-30T08:30:00Z'), snoozeUntilDay: '2025-07-05' });
    const b = ev({ id: 'b', kind: 'snoozed', at: NOW, snoozeUntilDay: '2025-07-02' });
    const undoB = ev({ id: 'u', kind: 'undo', at: NOW + 1000, undoesId: 'b' });
    expect(first(p, [a, b, undoB], at('2025-07-03T08:30:00Z'))).toBeUndefined();
  });

  it('a skip or a check after a snooze clears it', () => {
    const p = plant({ summer: every(1) });
    const snooze = ev({ id: 'z', kind: 'snoozed', at: at('2025-06-29T08:30:00Z'), snoozeUntilDay: '2025-07-20' });
    const skipped = ev({ id: 's', kind: 'skipped', at: at('2025-06-30T08:30:00Z') });
    const checked = ev({ id: 'c', kind: 'checked_moist', at: at('2025-06-30T08:30:00Z') });
    expect(first(p, [snooze, skipped], NOW)).toMatchObject({ dueDay: '2025-07-01' });
    expect(first(p, [snooze, checked], NOW)).toMatchObject({ dueDay: '2025-07-02' });
  });

  it('a snooze on water leaves fertilize and other plants alone', () => {
    const a = plant({ summer: every(1) }, at('2025-06-01T08:30:00Z'), every(1));
    const other = { ...plant({ summer: every(1) }), id: 'P2' };
    const snooze = ev({ id: 'z', kind: 'snoozed', at: NOW, snoozeUntilDay: '2025-07-10' });
    const tasks = computeTasks([a, other], [snooze], NOW).map((t) => `${t.plantId}:${t.task}`);
    expect(tasks.sort()).toEqual(['P1:fertilize', 'P2:water']);
  });
});

describe('nextDue — snooze across a season change', () => {
  // Persian summer ends at 2025-09-22T20:30:00Z (Tehran midnight, 1 Mehr = 2025-09-23).
  const done = ev({ id: 'd', kind: 'done', at: at('2025-09-15T08:30:00Z') });
  const snooze = ev({ id: 'z', kind: 'snoozed', at: at('2025-09-21T08:30:00Z'), snoozeUntilDay: '2025-09-25' });

  it('stays hidden across the boundary until the snooze day, then follows the new season', () => {
    const p = plant({ summer: every(3), autumn: every(10) });
    expect(first(p, [done, snooze], at('2025-09-22T08:30:00Z'))).toBeUndefined(); // last summer day
    expect(first(p, [done, snooze], at('2025-09-23T08:30:00Z'))).toBeUndefined(); // first autumn day
    expect(first(p, [done, snooze], at('2025-09-24T08:30:00Z'))).toBeUndefined();
    const back = first(p, [done, snooze], at('2025-09-25T08:30:00Z'));
    expect(back).toMatchObject({ season: 'autumn', everyDays: 10, dueDay: '2025-09-25', status: 'today' });
  });

  it('does not stretch or shorten the new season due day: it is anchor + new interval', () => {
    const p = plant({ summer: every(3), autumn: every(4) });
    const back = first(p, [done, snooze], at('2025-09-25T08:30:00Z'));
    expect(back).toMatchObject({ season: 'autumn', dueDay: '2025-09-19', status: 'overdue', daysOverdue: 6 });
  });

  it('a new season that is inactive or unknown yields no task once the snooze ends', () => {
    const inactive = plant({ summer: every(3), autumn: { mode: 'inactive', source: 'user' } });
    const unknown = plant({ summer: every(3), autumn: { mode: 'unknown', source: 'default' } });
    const later = at('2025-09-26T08:30:00Z');
    expect(first(inactive, [done, snooze], later)).toBeUndefined();
    expect(first(unknown, [done, snooze], later)).toBeUndefined();
  });

  it('a snooze that expires exactly on the first day of the new season shows the new season task', () => {
    const p = plant({ summer: every(3), autumn: every(2) });
    const ends = ev({ id: 'z', kind: 'snoozed', at: at('2025-09-21T08:30:00Z'), snoozeUntilDay: '2025-09-23' });
    expect(first(p, [done, ends], at('2025-09-22T20:29:59Z'))).toBeUndefined();
    expect(first(p, [done, ends], at('2025-09-22T20:30:00Z'))).toMatchObject({ season: 'autumn', everyDays: 2 });
  });

  it('a done recorded after the season change replaces the old snooze and starts the new interval', () => {
    const p = plant({ summer: every(3), autumn: every(10) });
    const doneInAutumn = ev({ id: 'd2', kind: 'done', at: at('2025-09-24T08:30:00Z'), seasonAtTime: 'autumn' });
    const now = at('2025-09-24T09:30:00Z');
    expect(first(p, [done, snooze, doneInAutumn], now)).toMatchObject({ dueDay: '2025-10-04', status: 'upcoming' });
  });

  it('history is untouched: removing the snooze event returns the unsnoozed schedule', () => {
    const p = plant({ summer: every(3), autumn: every(10) });
    const events = [done, snooze];
    const before = structuredClone(events);
    first(p, events, at('2025-09-24T08:30:00Z'));
    expect(events).toEqual(before);
    expect(first(p, [done], at('2025-09-24T08:30:00Z'))).toMatchObject({ dueDay: '2025-09-25', status: 'upcoming' });
  });
});
