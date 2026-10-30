import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { eventsRepo } from '../../data/events';
import { plantsRepo } from '../../data/plants';
import { undoneIds, type CareEvent, type Task } from '../../domain/events';
import { seasonFor } from '../../domain/season';
import type { Plant, TaskSetting } from '../../domain/schemas';
import { fa } from '../../i18n/fa';
import { ConfirmPanel } from '../../ui/ConfirmPanel';
import { formatDateTime } from '../../ui/format';
import { PlantThumb } from '../../ui/PlantThumb';
import { useNow } from '../../ui/useNow';
import { useSettings } from '../../ui/useSettings';
import { useUndo } from '../../ui/UndoProvider';
import { QrSection } from './QrSection';

type Load = { state: 'missing' } | { state: 'ready'; plant: Plant };

function eventLabel(e: CareEvent): string {
  return fa.history.kind[e.kind][e.task];
}

function summary(s: TaskSetting): string {
  if (s.mode === 'interval') return fa.schedule.summaryInterval(s.everyDays);
  return s.mode === 'inactive' ? fa.schedule.summaryInactive : fa.schedule.summaryUnknown;
}

export function PlantDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const undo = useUndo();
  const settings = useSettings();
  const now = useNow();
  const load = useLiveQuery<Load>(async () => {
    const plant = await plantsRepo.get(id);
    return plant ? { state: 'ready', plant } : { state: 'missing' };
  }, [id]);
  const events = useLiveQuery(() => eventsRepo.listForPlant(id), [id]);
  const [confirm, setConfirm] = useState<'archive' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!load || !events || !settings) return null;
  if (load.state === 'missing') {
    return (
      <section aria-labelledby="page-title">
        <h1 id="page-title">{fa.qr.notFoundTitle}</h1>
        <p>{fa.qr.notFoundBody}</p>
        <Link to="/plants" className="btn">{fa.qr.goPlants}</Link>
      </section>
    );
  }

  const { plant } = load;
  const { timeZone: TZ, calendar } = settings;
  const when = (at: number | null) => (at === null ? fa.detail.never : formatDateTime(at, TZ, calendar));
  const season = seasonFor(now, TZ, calendar);
  const careNow = plant.care[season];
  const nothingSet = careNow.water.mode !== 'interval' && careNow.fertilize.mode !== 'interval';
  const archived = plant.archivedAt !== null;
  const undone = undoneIds(events);

  async function record(task: Task, kind: 'done' | 'checked_moist', label: string) {
    setError(null);
    try {
      const e = await eventsRepo.record({ plantId: plant.id, task, kind });
      undo.push(`${plant.name} — ${label}`, [e.id]);
    } catch {
      setError(fa.actions.failed);
    }
  }

  async function undoOne(eventId: string) {
    setError(null);
    try {
      await eventsRepo.undo(eventId);
    } catch {
      setError(fa.undo.failed);
    }
  }

  async function runConfirmed() {
    setError(null);
    try {
      if (confirm === 'remove') {
        await plantsRepo.remove(plant.id);
        navigate('/plants');
        return;
      }
      if (archived) await plantsRepo.unarchive(plant.id);
      else await plantsRepo.archive(plant.id);
      setConfirm(null);
    } catch {
      setError(fa.detail.failed);
    }
  }

  const info: Array<[string, string]> = [
    [fa.detail.species, plant.species ?? fa.detail.unknown],
    [fa.detail.room, plant.room ?? fa.detail.unknown],
    [fa.detail.light, fa.options.light[plant.light]],
    [fa.detail.potMaterial, fa.options.potMaterial[plant.potMaterial]],
    [fa.detail.potSize, plant.potSizeCm === null ? fa.detail.unknown : fa.detail.cm(plant.potSizeCm)],
    [fa.detail.soil, fa.options.soil[plant.soil]],
  ];

  return (
    <section aria-labelledby="page-title">
      <div className="detail-head">
        <PlantThumb plantId={plant.id} large />
        <div>
          <h1 id="page-title">
            {plant.name}
            {plant.demo && <span className="badge badge-demo">{fa.demo.badge}</span>}
          </h1>
          <div className="form-actions">
            <Link to={`/plants/${plant.id}/edit`} className="btn">{fa.detail.edit}</Link>
            <Link to="/plants" className="btn btn-quiet">{fa.detail.back}</Link>
          </div>
        </div>
      </div>

      {archived && <p className="notice">{fa.detail.archivedBanner}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}

      {!archived && (
        <>
          <h2>{fa.detail.manualTitle}</h2>
          <p className="muted">{fa.detail.manualHint}</p>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => record('water', 'done', fa.actions.waterDone)}>
              {fa.actions.waterDone}
            </button>
            <button type="button" className="btn" onClick={() => record('water', 'checked_moist', fa.actions.stillMoist)}>
              {fa.actions.stillMoist}
            </button>
            <button type="button" className="btn" onClick={() => record('fertilize', 'done', fa.actions.fertilizeDone)}>
              {fa.actions.fertilizeDone}
            </button>
          </div>
        </>
      )}

      <h2>{fa.detail.last}</h2>
      <dl className="facts">
        <dt>{fa.detail.lastWatered}</dt>
        <dd>{when(plant.lastWateredAt)}</dd>
        <dt>{fa.detail.lastSoilCheck}</dt>
        <dd>{when(plant.lastSoilCheckAt)}</dd>
        <dt>{fa.detail.lastFertilized}</dt>
        <dd>{when(plant.lastFertilizedAt)}</dd>
      </dl>

      <h2>{fa.schedule.summaryTitle} ({fa.seasons[season]})</h2>
      <dl className="facts">
        <div className="fact">
          <dt>{fa.tasks.water}</dt>
          <dd>{summary(careNow.water)}</dd>
        </div>
        <div className="fact">
          <dt>{fa.tasks.fertilize}</dt>
          <dd>{summary(careNow.fertilize)}</dd>
        </div>
      </dl>
      {nothingSet && <p className="muted">{fa.schedule.noneSet}</p>}
      <Link to={`/p/${plant.id}/schedule`} className="btn">{fa.schedule.edit}</Link>

      <h2>{fa.detail.info}</h2>
      <dl className="facts">
        {info.map(([k, v]) => (
          <div key={k} className="fact">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        {plant.notes && (
          <div className="fact">
            <dt>{fa.detail.notes}</dt>
            <dd className="pre">{plant.notes}</dd>
          </div>
        )}
      </dl>

      <QrSection plant={plant} />

      <h2>{fa.history.title}</h2>
      <p className="muted">{fa.history.note}</p>
      {events.length === 0 ? (
        <p>{fa.history.empty}</p>
      ) : (
        <ol className="history">
          {events.map((e) => {
            const isUndone = undone.has(e.id);
            return (
              <li key={e.id} className={isUndone || e.kind === 'undo' ? 'history-muted' : undefined}>
                <span className={isUndone ? 'struck' : undefined}>{eventLabel(e)}</span>
                <span className="muted"> · {formatDateTime(e.at, TZ, calendar)}</span>
                {isUndone && <span className="badge">{fa.history.undone}</span>}
                {!isUndone && e.kind !== 'undo' && (
                  <button
                    type="button"
                    className="btn btn-quiet"
                    aria-label={`${fa.history.undoItem}: ${eventLabel(e)}`}
                    onClick={() => undoOne(e.id)}
                  >
                    {fa.undo.button}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="form-actions danger-zone">
        <button type="button" className="btn" onClick={() => setConfirm('archive')}>
          {archived ? fa.detail.unarchive : fa.detail.archive}
        </button>
        <button type="button" className="btn btn-danger" onClick={() => setConfirm('remove')}>
          {fa.detail.remove}
        </button>
      </div>

      {confirm === 'archive' && (
        <ConfirmPanel
          title={archived ? fa.detail.unarchive : fa.detail.archiveConfirmTitle(plant.name)}
          confirmLabel={fa.detail.confirm}
          cancelLabel={fa.detail.cancel}
          onConfirm={runConfirmed}
          onCancel={() => setConfirm(null)}
        >
          {!archived && <p>{fa.detail.archiveConfirmBody}</p>}
        </ConfirmPanel>
      )}
      {confirm === 'remove' && (
        <ConfirmPanel
          title={fa.detail.removeConfirmTitle(plant.name)}
          confirmLabel={fa.detail.remove}
          cancelLabel={fa.detail.cancel}
          danger
          onConfirm={runConfirmed}
          onCancel={() => setConfirm(null)}
        >
          <p>{fa.detail.removeConfirmBody}</p>
        </ConfirmPanel>
      )}
    </section>
  );
}
