import { addDays, dayKey, diffDays } from './dayKey';
import { deriveCaches, effectiveEvents, type CareEvent } from './events';
import { buildPlant } from './defaults';
import { EMPTY_FILTER, filterPlants, groupByRoom, isIncomplete, NO_ROOM, roomsOf } from './plantFilter';
import { matchesQuery, normalizeText } from './search';
import { seasonFor } from './season';
import type { Plant, Season } from './schemas';
import { computeTasks, DEFAULT_SCHEDULE_SETTINGS } from './tasks';

const TZ = 'Asia/Tehran';
const at = (iso: string) => Date.parse(iso);

describe('dayKey (Asia/Tehran)', () => {
  it('rolls over at Tehran midnight (UTC+3:30), not UTC midnight', () => {
    expect(dayKey(at('2025-03-20T20:29:59Z'), TZ)).toBe('2025-03-20');
    expect(dayKey(at('2025-03-20T20:30:00Z'), TZ)).toBe('2025-03-21');
    expect(dayKey(at('2025-03-20T23:59:59Z'), TZ)).toBe('2025-03-21');
  });

  it('differs from the UTC day late in the evening UTC', () => {
    const instant = at('2025-07-01T22:00:00Z');
    expect(dayKey(instant, 'UTC')).toBe('2025-07-01');
    expect(dayKey(instant, TZ)).toBe('2025-07-02');
  });

  it('does not depend on the machine time zone', () => {
    expect(dayKey(at('2025-01-01T00:00:00Z'), 'Pacific/Kiritimati')).toBe('2025-01-01');
    expect(dayKey(at('2025-01-01T00:00:00Z'), 'Pacific/Pago_Pago')).toBe('2024-12-31');
  });

  it('adds and diffs days across month and leap boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
    expect(diffDays('2025-01-01', '2025-01-11')).toBe(10);
    expect(diffDays('2025-01-11', '2025-01-01')).toBe(-10);
  });
});

describe('seasonFor — Persian calendar', () => {
  const cases: Array<[string, string, Season]> = [
    ['last second of Esfand 1403', '2025-03-20T20:29:59Z', 'winter'],
    ['1 Farvardin 1404 00:00 Tehran', '2025-03-20T20:30:00Z', 'spring'],
    ['last second of Khordad', '2025-06-21T20:29:59Z', 'spring'],
    ['1 Tir 00:00 Tehran', '2025-06-21T20:30:00Z', 'summer'],
    ['last second of Shahrivar', '2025-09-22T20:29:59Z', 'summer'],
    ['1 Mehr 00:00 Tehran', '2025-09-22T20:30:00Z', 'autumn'],
    ['last second of Azar', '2025-12-21T20:29:59Z', 'autumn'],
    ['1 Dey 00:00 Tehran', '2025-12-21T20:30:00Z', 'winter'],
  ];
  it.each(cases)('%s', (_label, iso, expected) => {
    expect(seasonFor(at(iso), TZ, 'persian')).toBe(expected);
  });

  it('uses the time zone, not UTC, at the boundary', () => {
    const instant = at('2025-03-20T21:00:00Z');
    expect(seasonFor(instant, 'UTC', 'persian')).toBe('winter');
    expect(seasonFor(instant, TZ, 'persian')).toBe('spring');
  });
});

describe('seasonFor — Gregorian calendar', () => {
  it.each<[string, Season]>([
    ['2025-02-28T12:00:00Z', 'winter'],
    ['2025-03-01T12:00:00Z', 'spring'],
    ['2025-05-31T12:00:00Z', 'spring'],
    ['2025-06-01T12:00:00Z', 'summer'],
    ['2025-08-31T12:00:00Z', 'summer'],
    ['2025-09-01T12:00:00Z', 'autumn'],
    ['2025-11-30T12:00:00Z', 'autumn'],
    ['2025-12-01T12:00:00Z', 'winter'],
    ['2025-01-15T12:00:00Z', 'winter'],
  ])('%s is %s', (iso, expected) => {
    expect(seasonFor(at(iso), TZ, 'gregorian')).toBe(expected);
  });
});

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

describe('effectiveEvents / deriveCaches', () => {
  it('drops undo markers and the events they cancel', () => {
    const events = [
      ev({ id: 'a', kind: 'done', at: 1 }),
      ev({ id: 'b', kind: 'done', at: 2 }),
      ev({ id: 'u', kind: 'undo', at: 3, undoesId: 'b' }),
    ];
    expect(effectiveEvents(events).map((e) => e.id)).toEqual(['a']);
  });

  it('derives caches from effective events only', () => {
    const events = [
      ev({ id: 'a', kind: 'done', at: 100 }),
      ev({ id: 'b', kind: 'checked_moist', at: 200 }),
      ev({ id: 'c', kind: 'done', at: 300, task: 'fertilize' }),
      ev({ id: 'd', kind: 'done', at: 400 }),
      ev({ id: 'u', kind: 'undo', at: 500, undoesId: 'd' }),
      ev({ id: 's', kind: 'skipped', at: 600 }),
    ];
    expect(deriveCaches(events)).toEqual({
      lastWateredAt: 100,
      lastSoilCheckAt: 200,
      lastFertilizedAt: 300,
    });
  });

  it('is all null with no events', () => {
    expect(deriveCaches([])).toEqual({ lastWateredAt: null, lastSoilCheckAt: null, lastFertilizedAt: null });
  });
});

function plantWith(
  id: string,
  createdAt: number,
  season: Season,
  water: Plant['care']['spring']['water'],
  fertilize?: Plant['care']['spring']['fertilize'],
): Plant {
  const p = buildPlant(id, { name: id }, createdAt);
  p.care[season].water = water;
  if (fertilize) p.care[season].fertilize = fertilize;
  return p;
}

const every = (n: number) => ({ mode: 'interval' as const, everyDays: n, source: 'user' as const });
// 2025-07-01 noon UTC → Tehran 2025-07-01, Persian summer
const NOW = at('2025-07-01T08:30:00Z');
const created = at('2025-06-20T08:30:00Z');

describe('computeTasks', () => {
  it('produces nothing for unknown or inactive settings', () => {
    const unknown = plantWith('U', created, 'summer', { mode: 'unknown', source: 'default' });
    const inactive = plantWith('I', created, 'summer', { mode: 'inactive', source: 'user' });
    expect(computeTasks([unknown, inactive], [], NOW)).toEqual([]);
  });

  it('uses the settings of the current season only', () => {
    const p = plantWith('W', created, 'winter', every(3));
    expect(computeTasks([p], [], NOW)).toEqual([]);
  });

  it('anchors on the creation day when there is no history', () => {
    const p = plantWith('A', created, 'summer', every(7));
    const [t] = computeTasks([p], [], NOW);
    expect(t).toMatchObject({ dueDay: '2025-06-27', status: 'overdue', daysOverdue: 4, season: 'summer' });
  });

  it('reports today / upcoming / overdue relative to the Tehran day', () => {
    const today = plantWith('T', created, 'summer', every(11)); // 06-20 + 11 = 07-01
    const later = plantWith('L', created, 'summer', every(12));
    const [a] = computeTasks([today], [], NOW);
    const [b] = computeTasks([later], [], NOW);
    expect(a?.status).toBe('today');
    expect(b?.status).toBe('upcoming');
  });

  it('a done event restarts the interval; undone events are ignored', () => {
    const p = plantWith('D', created, 'summer', every(7));
    const done = ev({ id: 'e1', plantId: 'D', kind: 'done', at: at('2025-06-30T08:30:00Z') });
    expect(computeTasks([p], [done], NOW)[0]).toMatchObject({ dueDay: '2025-07-07', status: 'upcoming' });
    const undo = ev({ id: 'e2', plantId: 'D', kind: 'undo', at: NOW, undoesId: 'e1' });
    expect(computeTasks([p], [done, undo], NOW)[0]?.status).toBe('overdue');
  });

  it('checked_moist uses the short re-check gap, not the full interval', () => {
    const p = plantWith('M', created, 'summer', every(10));
    const checked = ev({ id: 'e1', plantId: 'M', kind: 'checked_moist', at: at('2025-06-29T08:30:00Z') });
    expect(computeTasks([p], [checked], NOW)[0]).toMatchObject({
      dueDay: addDays('2025-06-29', DEFAULT_SCHEDULE_SETTINGS.checkedMoistGapDays),
      status: 'today',
    });
  });

  it('skipped resets the anchor without being a failure', () => {
    const p = plantWith('S', created, 'summer', every(5));
    const skipped = ev({ id: 'e1', plantId: 'S', kind: 'skipped', at: at('2025-06-30T08:30:00Z') });
    expect(computeTasks([p], [skipped], NOW)[0]).toMatchObject({ dueDay: '2025-07-05', status: 'upcoming' });
  });

  it('a snooze hides the task until its day, then it returns', () => {
    const p = plantWith('Z', created, 'summer', every(7));
    const snooze = ev({ id: 'e1', plantId: 'Z', kind: 'snoozed', at: NOW, snoozeUntilDay: '2025-07-02' });
    expect(computeTasks([p], [snooze], NOW)).toEqual([]);
    const nextDay = at('2025-07-02T08:30:00Z');
    expect(computeTasks([p], [snooze], nextDay)[0]?.status).toBe('overdue');
  });

  it('a snooze made before a later done does not hide the next cycle', () => {
    const p = plantWith('Y', created, 'summer', every(1));
    const snooze = ev({ id: 'e1', plantId: 'Y', kind: 'snoozed', at: at('2025-06-29T08:30:00Z'), snoozeUntilDay: '2025-07-10' });
    const done = ev({ id: 'e2', plantId: 'Y', kind: 'done', at: at('2025-06-30T08:30:00Z') });
    expect(computeTasks([p], [snooze, done], NOW)[0]?.status).toBe('today');
  });

  it('skips archived plants and keeps events of other plants separate', () => {
    const a = plantWith('A1', created, 'summer', every(7));
    const archived = { ...plantWith('A2', created, 'summer', every(7)), archivedAt: 5 };
    const other = ev({ id: 'e1', plantId: 'A2', kind: 'done', at: NOW });
    const tasks = computeTasks([a, archived], [other], NOW);
    expect(tasks.map((t) => t.plantId)).toEqual(['A1']);
    expect(tasks[0]?.status).toBe('overdue');
  });

  it('rolls over at Tehran midnight: 23:59 vs 00:00', () => {
    const p = plantWith('R', at('2025-06-24T08:30:00Z'), 'summer', every(7)); // due 2025-07-01
    const before = computeTasks([p], [], at('2025-06-30T20:29:59Z'))[0];
    const after = computeTasks([p], [], at('2025-06-30T20:30:00Z'))[0];
    expect(before?.status).toBe('upcoming');
    expect(after?.status).toBe('today');
  });

  it('switches to the new season settings at a season boundary and keeps history', () => {
    const p = buildPlant('B', { name: 'B' }, at('2025-06-01T08:30:00Z'));
    p.care.spring.water = every(30);
    p.care.summer.water = every(2);
    const done = ev({ id: 'e1', plantId: 'B', kind: 'done', at: at('2025-06-20T08:30:00Z'), seasonAtTime: 'spring' });
    const lastSpring = computeTasks([p], [done], at('2025-06-21T20:29:59Z'))[0];
    const firstSummer = computeTasks([p], [done], at('2025-06-21T20:30:00Z'))[0];
    expect(lastSpring).toMatchObject({ season: 'spring', everyDays: 30, status: 'upcoming' });
    expect(firstSummer).toMatchObject({ season: 'summer', everyDays: 2, status: 'today' });
  });
});

describe('search', () => {
  it('folds Arabic variants, digits and ZWNJ', () => {
    expect(normalizeText('كيوي')).toBe('کیوی');
    expect(normalizeText('٣ و ۴')).toBe('3 و 4');
    expect(normalizeText('می‌خواهم')).toBe(normalizeText('میخواهم'));
  });

  it('requires every token and ignores empty queries', () => {
    expect(matchesQuery(['مونسترا', 'نشیمن'], 'مونسترا نشیمن')).toBe(true);
    expect(matchesQuery(['مونسترا', 'نشیمن'], 'مونسترا آشپزخانه')).toBe(false);
    expect(matchesQuery([null, undefined], '')).toBe(true);
    expect(matchesQuery(['Ficus'], 'fic')).toBe(true);
  });
});

describe('plantFilter', () => {
  const full = (id: string, room: string | null): Plant => ({
    ...buildPlant(id, { name: id, species: 'x', room: room ?? '', light: 'low', potMaterial: 'plastic', soil: 'standard' }, 1),
  });
  const a = full('الف', 'نشیمن');
  const b = full('ب', 'آشپزخانه');
  const c = buildPlant('ج', { name: 'ج' }, 1);

  it('detects incomplete plants', () => {
    expect(isIncomplete(a)).toBe(false);
    expect(isIncomplete(c)).toBe(true);
  });

  it('filters by query, room, no-room and status', () => {
    const due = new Set([b.id]);
    expect(filterPlants([a, b, c], { ...EMPTY_FILTER, query: 'الف' }, due)).toEqual([a]);
    expect(filterPlants([a, b, c], { ...EMPTY_FILTER, room: 'آشپزخانه' }, due)).toEqual([b]);
    expect(filterPlants([a, b, c], { ...EMPTY_FILTER, room: NO_ROOM }, due)).toEqual([c]);
    expect(filterPlants([a, b, c], { ...EMPTY_FILTER, status: 'due' }, due)).toEqual([b]);
    expect(filterPlants([a, b, c], { ...EMPTY_FILTER, status: 'incomplete' }, due)).toEqual([c]);
  });

  it('lists rooms and groups with unroomed plants last', () => {
    expect(roomsOf([a, b, c])).toEqual(['آشپزخانه', 'نشیمن']);
    const groups = groupByRoom([c, a, b]);
    expect(groups.map((g) => g.room)).toEqual(['آشپزخانه', 'نشیمن', null]);
  });
});
