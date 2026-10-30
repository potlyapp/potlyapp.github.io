import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { checkStorage } from '../../data/db';
import { eventsRepo } from '../../data/events';
import { plantsRepo } from '../../data/plants';
import {
  EMPTY_FILTER,
  filterPlants,
  groupByRoom,
  NO_ROOM,
  roomsOf,
  STATUS_FILTERS,
  type PlantFilter,
  type StatusFilter,
} from '../../domain/plantFilter';
import type { Plant } from '../../domain/schemas';
import { computeTasks } from '../../domain/tasks';
import { fa } from '../../i18n/fa';
import { PlantThumb } from '../../ui/PlantThumb';
import { useNow } from '../../ui/useNow';

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: fa.plants.statusAll,
  due: fa.plants.statusDue,
  incomplete: fa.plants.statusIncomplete,
};

function PlantRow({ plant }: { plant: Plant }) {
  return (
    <li>
      <Link to={`/p/${plant.id}`} className="plant-row">
        <PlantThumb plantId={plant.id} />
        <span className="plant-row-text">
          <strong>{plant.name}</strong>
          {plant.demo && <span className="badge badge-demo">{fa.demo.badge}</span>}
          {(plant.species || plant.room) && (
            <span className="muted">{[plant.species, plant.room].filter(Boolean).join(' · ')}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function PlantsPage() {
  const plants = useLiveQuery(() => plantsRepo.list(), []);
  const archived = useLiveQuery(() => plantsRepo.listArchived(), []);
  const events = useLiveQuery(() => eventsRepo.listAll(), []);
  const now = useNow();
  const [storageOk, setStorageOk] = useState(true);
  const [filter, setFilter] = useState<PlantFilter>(EMPTY_FILTER);
  const [grouped, setGrouped] = useState(false);

  useEffect(() => {
    checkStorage().then(setStorageOk);
  }, []);

  const dueIds = useMemo(() => {
    if (!plants || !events) return new Set<string>();
    return new Set(
      computeTasks(plants, events, now)
        .filter((t) => t.status !== 'upcoming')
        .map((t) => t.plantId),
    );
  }, [plants, events, now]);

  const visible = useMemo(() => (plants ? filterPlants(plants, filter, dueIds) : []), [plants, filter, dueIds]);
  const rooms = useMemo(() => roomsOf(plants ?? []), [plants]);
  const hasRoomless = (plants ?? []).some((p) => !p.room);
  const filtering = filter.query !== '' || filter.room !== '' || filter.status !== 'all';

  return (
    <section aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">{fa.plants.title}</h1>
        <Link to="/plants/new" className="btn btn-primary">{fa.plants.add}</Link>
      </div>

      {!storageOk && <p role="alert" className="form-error">{fa.storage.unavailable}</p>}

      {plants && plants.length === 0 && (
        <div className="empty">
          <h2>{fa.plants.emptyTitle}</h2>
          <p>{fa.plants.emptyBody}</p>
        </div>
      )}

      {plants && plants.length > 0 && (
        <>
          <div className="filters">
            <div className="field">
              <label htmlFor="plant-search">{fa.plants.search}</label>
              <input
                id="plant-search"
                type="search"
                value={filter.query}
                placeholder={fa.plants.searchPlaceholder}
                onChange={(e) => setFilter({ ...filter, query: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="plant-room">{fa.plants.room}</label>
              <select id="plant-room" value={filter.room} onChange={(e) => setFilter({ ...filter, room: e.target.value })}>
                <option value="">{fa.plants.allRooms}</option>
                {rooms.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                {hasRoomless && <option value={NO_ROOM}>{fa.plants.noRoom}</option>}
              </select>
            </div>
            <div className="field">
              <label htmlFor="plant-status">{fa.plants.status}</label>
              <select
                id="plant-status"
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value as StatusFilter })}
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <label className="check">
              <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
              <span>{fa.plants.groupByRoom}</span>
            </label>
          </div>

          <p className="muted" aria-live="polite">
            {filtering ? fa.plants.shown(visible.length, plants.length) : fa.plants.count(plants.length)}
          </p>

          {visible.length === 0 ? (
            <div className="empty">
              <p>{fa.plants.noMatches}</p>
              <button type="button" className="btn" onClick={() => setFilter(EMPTY_FILTER)}>
                {fa.plants.clearFilters}
              </button>
            </div>
          ) : grouped ? (
            groupByRoom(visible).map((g) => (
              <div key={g.room ?? NO_ROOM}>
                <h2>{g.room ?? fa.plants.noRoom}</h2>
                <ul className="plant-list">
                  {g.plants.map((p) => <PlantRow key={p.id} plant={p} />)}
                </ul>
              </div>
            ))
          ) : (
            <ul className="plant-list">
              {visible.map((p) => <PlantRow key={p.id} plant={p} />)}
            </ul>
          )}
        </>
      )}

      {archived && archived.length > 0 && (
        <details className="archived">
          <summary>{fa.plants.archived(archived.length)}</summary>
          <ul className="plant-list">
            {archived.map((p) => <PlantRow key={p.id} plant={p} />)}
          </ul>
        </details>
      )}
    </section>
  );
}
