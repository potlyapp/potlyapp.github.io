import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { eventsRepo } from '../../data/events';
import { plantsRepo } from '../../data/plants';
import { addDays, dayKey } from '../../domain/dayKey';
import type { EventKind, Task } from '../../domain/events';
import { computeTasks, DEFAULT_SCHEDULE_SETTINGS, type DueTask } from '../../domain/tasks';
import { fa } from '../../i18n/fa';
import { ConfirmPanel } from '../../ui/ConfirmPanel';
import { useNow } from '../../ui/useNow';
import { useUndo } from '../../ui/UndoProvider';

type BulkKind = Extract<EventKind, 'done' | 'snoozed' | 'skipped'>;

const rowKey = (t: { plantId: string; task: Task }) => `${t.plantId}|${t.task}`;

function doneLabel(task: Task): string {
  return task === 'water' ? fa.actions.waterDone : fa.actions.fertilizeDone;
}

function bulkLabel(kind: BulkKind): string {
  if (kind === 'done') return fa.today.bulkDone;
  return kind === 'snoozed' ? fa.actions.snooze : fa.actions.skip;
}

function sortDue(a: DueTask, b: DueTask): number {
  return b.daysOverdue - a.daysOverdue || a.dueDay.localeCompare(b.dueDay);
}

export function TodayPage() {
  const plants = useLiveQuery(() => plantsRepo.list(), []);
  const events = useLiveQuery(() => eventsRepo.listAll(), []);
  const now = useNow();
  const undo = useUndo();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<BulkKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = useMemo(() => new Map((plants ?? []).map((p) => [p.id, p.name])), [plants]);
  const due = useMemo(() => {
    if (!plants || !events) return null;
    return computeTasks(plants, events, now)
      .filter((t) => t.status !== 'upcoming')
      .sort(sortDue);
  }, [plants, events, now]);

  if (!due) return null;

  const chosen = due.filter((t) => selected.has(rowKey(t)));
  const overdue = due.filter((t) => t.status === 'overdue');
  const today = due.filter((t) => t.status === 'today');
  const tomorrow = () => addDays(dayKey(now, DEFAULT_SCHEDULE_SETTINGS.timeZone), 1);

  function toggle(t: DueTask) {
    const next = new Set(selected);
    if (!next.delete(rowKey(t))) next.add(rowKey(t));
    setSelected(next);
  }

  async function act(t: DueTask, kind: EventKind) {
    setError(null);
    try {
      const event =
        kind === 'snoozed'
          ? await eventsRepo.snooze(t.plantId, t.task, 1)
          : await eventsRepo.record({ plantId: t.plantId, task: t.task, kind });
      const what =
        kind === 'done' ? doneLabel(t.task) : kind === 'checked_moist' ? fa.actions.stillMoist : kind === 'snoozed' ? fa.actions.snooze : fa.actions.skip;
      undo.push(`${names.get(t.plantId) ?? ''} — ${what}`, [event.id]);
    } catch {
      setError(fa.actions.failed);
    }
  }

  async function confirmBulk() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const created = await eventsRepo.recordMany(
        chosen.map((t) => ({ plantId: t.plantId, task: t.task })),
        { kind: pending, snoozeUntilDay: pending === 'snoozed' ? tomorrow() : null },
      );
      undo.push(`${bulkLabel(pending)} (${chosen.length.toLocaleString('fa-IR')})`, created.map((e) => e.id));
      setSelected(new Set());
      setPending(null);
    } catch {
      setError(fa.today.bulkFailed);
    } finally {
      setBusy(false);
    }
  }

  function renderRow(t: DueTask) {
    const name = names.get(t.plantId) ?? '';
    const taskName = fa.tasks[t.task];
    return (
      <li key={rowKey(t)} className="task-row">
        <label className="check task-select">
          <input
            type="checkbox"
            checked={selected.has(rowKey(t))}
            onChange={() => toggle(t)}
            aria-label={fa.today.selectRow(name, taskName)}
          />
        </label>
        <div className="task-body">
          <Link to={`/p/${t.plantId}`} className="task-plant">{name}</Link>
          <span className="muted">
            {taskName}
            {t.status === 'overdue' && ` · ${fa.today.overdueBy(t.daysOverdue)}`}
          </span>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => act(t, 'done')}>
              {doneLabel(t.task)}
            </button>
            {t.task === 'water' && (
              <button type="button" className="btn" onClick={() => act(t, 'checked_moist')}>
                {fa.actions.stillMoist}
              </button>
            )}
            <button type="button" className="btn" onClick={() => act(t, 'snoozed')}>
              {fa.actions.snooze}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => act(t, 'skipped')}>
              {fa.actions.skip}
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{fa.today.title}</h1>
      {error && <p role="alert" className="form-error">{error}</p>}

      {due.length === 0 && (
        <div className="empty">
          <h2>{fa.today.emptyTitle}</h2>
          <p>{fa.today.emptyBody}</p>
        </div>
      )}

      {due.length > 0 && (
        <div className="bulk-bar">
          <button
            type="button"
            className="btn"
            onClick={() => setSelected(chosen.length === due.length ? new Set() : new Set(due.map(rowKey)))}
          >
            {chosen.length === due.length ? fa.today.selectNone : fa.today.selectAll}
          </button>
          {chosen.length > 0 && (
            <>
              <span aria-live="polite">{fa.today.selected(chosen.length)}</span>
              <button type="button" className="btn" onClick={() => setPending('done')}>
                {fa.today.bulkDone}
              </button>
              <button type="button" className="btn" onClick={() => setPending('snoozed')}>
                {fa.actions.snooze}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setPending('skipped')}>
                {fa.actions.skip}
              </button>
            </>
          )}
        </div>
      )}

      {pending && chosen.length > 0 && (
        <ConfirmPanel
          title={fa.today.bulkConfirmTitle(bulkLabel(pending))}
          confirmLabel={fa.today.bulkConfirm}
          cancelLabel={fa.today.bulkCancel}
          busy={busy}
          onConfirm={confirmBulk}
          onCancel={() => setPending(null)}
        >
          <ul aria-label={fa.today.bulkTitle}>
            {chosen.map((t) => (
              <li key={rowKey(t)}>
                {names.get(t.plantId)} — {fa.tasks[t.task]}
              </li>
            ))}
          </ul>
        </ConfirmPanel>
      )}

      {overdue.length > 0 && (
        <>
          <h2>{fa.today.overdue}</h2>
          <ul className="task-list">{overdue.map(renderRow)}</ul>
        </>
      )}
      {today.length > 0 && (
        <>
          <h2>{fa.today.dueToday}</h2>
          <ul className="task-list">{today.map(renderRow)}</ul>
        </>
      )}
    </section>
  );
}
