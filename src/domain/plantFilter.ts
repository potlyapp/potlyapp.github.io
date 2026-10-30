import { matchesQuery } from './search';
import type { Plant } from './schemas';

export const NO_ROOM = '__none__';
export const STATUS_FILTERS = ['all', 'due', 'incomplete'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export interface PlantFilter {
  query: string;
  /** Room name, `NO_ROOM`, or '' for all rooms. */
  room: string;
  status: StatusFilter;
}

export const EMPTY_FILTER: PlantFilter = { query: '', room: '', status: 'all' };

/** A plant is "incomplete" while any identifying detail is still unknown. */
export function isIncomplete(p: Plant): boolean {
  return !p.species || !p.room || p.light === 'unknown' || p.potMaterial === 'unknown' || p.soil === 'unknown';
}

export function filterPlants(plants: readonly Plant[], filter: PlantFilter, dueIds: ReadonlySet<string>): Plant[] {
  return plants.filter((p) => {
    if (!matchesQuery([p.name, p.species, p.room, p.notes], filter.query)) return false;
    if (filter.room === NO_ROOM && p.room) return false;
    if (filter.room && filter.room !== NO_ROOM && p.room !== filter.room) return false;
    if (filter.status === 'due' && !dueIds.has(p.id)) return false;
    if (filter.status === 'incomplete' && !isIncomplete(p)) return false;
    return true;
  });
}

export function roomsOf(plants: readonly Plant[]): string[] {
  return [...new Set(plants.map((p) => p.room).filter((r): r is string => !!r))].sort((a, b) =>
    a.localeCompare(b, 'fa'),
  );
}

export interface RoomGroup {
  room: string | null;
  plants: Plant[];
}

/** Named rooms first (alphabetical), plants without a room last. */
export function groupByRoom(plants: readonly Plant[]): RoomGroup[] {
  const groups = new Map<string | null, Plant[]>();
  for (const p of plants) {
    const list = groups.get(p.room);
    if (list) list.push(p);
    else groups.set(p.room, [p]);
  }
  const named = [...groups.entries()]
    .filter((e): e is [string, Plant[]] => e[0] !== null)
    .sort((a, b) => a[0].localeCompare(b[0], 'fa'))
    .map(([room, list]) => ({ room, plants: list }));
  const none = groups.get(null);
  return none ? [...named, { room: null, plants: none }] : named;
}
