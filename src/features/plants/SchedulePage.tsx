import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { plantsRepo } from '../../data/plants';
import { TASKS, type Task } from '../../domain/events';
import { seasonFor } from '../../domain/season';
import { SEASONS, type CareSettings, type Plant, type Season, type TaskSetting } from '../../domain/schemas';
import { fa } from '../../i18n/fa';
import { useNow } from '../../ui/useNow';
import { useSettings } from '../../ui/useSettings';

type Mode = TaskSetting['mode'];
interface Row {
  mode: Mode;
  days: string;
}
type Draft = Record<Season, Record<Task, Row>>;
type Errors = Partial<Record<`${Season}.${Task}`, string>>;

const MODES: Mode[] = ['unknown', 'inactive', 'interval'];

function toRow(s: TaskSetting): Row {
  return { mode: s.mode, days: s.mode === 'interval' ? String(s.everyDays) : '' };
}

function toDraft(care: CareSettings): Draft {
  const out = {} as Draft;
  for (const season of SEASONS) {
    out[season] = { water: toRow(care[season].water), fertilize: toRow(care[season].fertilize) };
  }
  return out;
}

function sameRow(a: Row, original: TaskSetting): boolean {
  const b = toRow(original);
  return a.mode === b.mode && (a.mode !== 'interval' || a.days.trim() === b.days);
}

/** Unchanged settings keep their provenance; anything the user touched becomes `user`. */
function buildCare(draft: Draft, original: CareSettings): { care: CareSettings; errors: Errors } {
  const errors: Errors = {};
  const care = structuredClone(original);
  for (const season of SEASONS) {
    for (const task of TASKS) {
      const row = draft[season][task];
      if (sameRow(row, original[season][task])) continue;
      if (row.mode === 'interval') {
        const n = Number(row.days);
        if (!row.days.trim() || !Number.isInteger(n) || n < 1 || n > 365) {
          errors[`${season}.${task}`] = fa.schedule.intervalInvalid;
          continue;
        }
        care[season][task] = { mode: 'interval', everyDays: n, source: 'user' };
      } else {
        care[season][task] = { mode: row.mode, source: 'user' };
      }
    }
  }
  return { care, errors };
}

export function SchedulePage() {
  const { id = '' } = useParams();
  const plant = useLiveQuery(async () => (await plantsRepo.get(id)) ?? null, [id]);
  if (plant === undefined) return null;
  if (plant === null) {
    return (
      <section aria-labelledby="page-title">
        <h1 id="page-title">{fa.form.notFound}</h1>
        <Link to="/plants">{fa.detail.back}</Link>
      </section>
    );
  }
  return <ScheduleForm key={plant.id} plant={plant} />;
}

function ScheduleForm({ plant }: { plant: Plant }) {
  const navigate = useNavigate();
  const settings = useSettings();
  const now = useNow();
  const [draft, setDraft] = useState<Draft>(() => toDraft(plant.care));
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!settings) return null;
  const current = seasonFor(now, settings.timeZone, settings.calendar);

  function setRow(season: Season, task: Task, patch: Partial<Row>) {
    setDraft((d) => ({ ...d, [season]: { ...d[season], [task]: { ...d[season][task], ...patch } } }));
  }

  function copyToAll(from: Season) {
    setDraft((d) => {
      const next = { ...d };
      for (const season of SEASONS) next[season] = structuredClone(d[from]);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    const { care, errors: found } = buildCare(draft, plant.care);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await plantsRepo.setCare(plant.id, care);
      navigate(`/p/${plant.id}`);
    } catch {
      setSaveError(fa.schedule.saveFailed);
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{fa.schedule.title(plant.name)}</h1>
      <p className="muted">{fa.schedule.intro}</p>
      <p className="muted">{fa.schedule.noSuggestions}</p>

      <form className="form" onSubmit={submit} noValidate>
        {SEASONS.map((season) => (
          <fieldset key={season} className="season-set">
            <legend>
              {fa.seasons[season]}
              {season === current && <span className="badge">{fa.schedule.currentSeason}</span>}
            </legend>
            {TASKS.map((task) => {
              const row = draft[season][task];
              const modeId = `sch-${season}-${task}-mode`;
              const daysId = `sch-${season}-${task}-days`;
              const errId = `sch-${season}-${task}-err`;
              const err = errors[`${season}.${task}`];
              const saved = plant.care[season][task];
              return (
                <div key={task} className="schedule-row">
                  <div className="field">
                    <label htmlFor={modeId}>{fa.schedule.taskInSeason(fa.tasks[task], fa.seasons[season])}</label>
                    <select
                      id={modeId}
                      value={row.mode}
                      onChange={(e) => setRow(season, task, { mode: e.target.value as Mode })}
                    >
                      {MODES.map((m) => (
                        <option key={m} value={m}>{fa.schedule.mode[m]}</option>
                      ))}
                    </select>
                  </div>
                  {row.mode === 'interval' && (
                    <div className="field">
                      <label htmlFor={daysId}>{fa.schedule.everyDaysFor(fa.tasks[task], fa.seasons[season])}</label>
                      <input
                        id={daysId}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={365}
                        step={1}
                        value={row.days}
                        aria-invalid={err ? true : undefined}
                        aria-describedby={err ? errId : undefined}
                        onChange={(e) => setRow(season, task, { days: e.target.value })}
                      />
                      {err && <small id={errId} className="field-error">{err}</small>}
                    </div>
                  )}
                  {saved.source !== 'user' && saved.mode !== 'unknown' && (
                    <small className="muted">{fa.schedule.source[saved.source]}</small>
                  )}
                </div>
              );
            })}
            <button type="button" className="btn btn-quiet" onClick={() => copyToAll(season)}>
              {fa.schedule.copyToAll(fa.seasons[season])}
            </button>
          </fieldset>
        ))}

        {saveError && <p role="alert" className="form-error">{saveError}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>{fa.form.save}</button>
          <Link to={`/p/${plant.id}`} className="btn btn-quiet">{fa.form.cancel}</Link>
        </div>
      </form>
    </section>
  );
}
