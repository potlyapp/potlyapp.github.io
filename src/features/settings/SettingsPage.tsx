import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { settingsRepo } from '../../data/settings';
import { baseUrlWarnings, normalizeBaseUrl } from '../../domain/qr';
import { seasonFor } from '../../domain/season';
import { isValidTimeZone, type AppSettings } from '../../domain/settings';
import { fa } from '../../i18n/fa';
import { formatDate } from '../../ui/format';
import { useNow } from '../../ui/useNow';
import { useSettings } from '../../ui/useSettings';
import { BackupSection } from './BackupSection';
import { CsvImportSection } from './CsvImportSection';
import { DemoSection } from './DemoSection';
import { InstallSection } from './InstallSection';
import { NotificationsSection } from './NotificationsSection';

const ZONES: readonly string[] = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['Asia/Tehran', 'UTC'];
  }
})();

export function SettingsPage() {
  const settings = useSettings();
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{fa.settings.title}</h1>
      {settings && <ScheduleSettingsForm settings={settings} />}
      {settings && <NotificationsSection settings={settings} />}
      {settings && <BackupSection settings={settings} />}
      <CsvImportSection />
      <DemoSection />
      <InstallSection />
      <p className="muted">{fa.settings.localOnly}</p>
    </section>
  );
}

function ScheduleSettingsForm({ settings }: { settings: AppSettings }) {
  const now = useNow();
  const [calendar, setCalendar] = useState(settings.calendar);
  const [timeZone, setTimeZone] = useState(settings.timeZone);
  const [gap, setGap] = useState(String(settings.checkedMoistGapDays));
  const [tzError, setTzError] = useState<string | null>(null);
  const [gapError, setGapError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl ?? '');
  const [baseUrlError, setBaseUrlError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const tzOk = isValidTimeZone(timeZone.trim());
  const preview = tzOk
    ? fa.settings.currentSeason(
        fa.seasons[seasonFor(now, timeZone.trim(), calendar)],
        formatDate(now, timeZone.trim(), calendar),
      )
    : null;

  const typedBase = baseUrl.trim() ? normalizeBaseUrl(baseUrl) : null;
  const baseWarnings = baseUrlWarnings(typedBase ?? window.location.origin, window.location.origin);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setFailed(false);
    const tz = timeZone.trim();
    const n = Number(gap);
    const tzBad = !isValidTimeZone(tz);
    const gapBad = !gap.trim() || !Number.isInteger(n) || n < 1 || n > 30;
    setTzError(tzBad ? fa.settings.timeZoneInvalid : null);
    setGapError(gapBad ? fa.settings.gapDaysInvalid : null);
    const rawBase = baseUrl.trim();
    const base = rawBase ? normalizeBaseUrl(rawBase) : null;
    const baseBad = rawBase !== '' && base === null;
    setBaseUrlError(baseBad ? fa.settings.baseUrlInvalid : null);
    if (tzBad || gapBad || baseBad) return;
    try {
      await settingsRepo.update({ calendar, timeZone: tz, checkedMoistGapDays: n, baseUrl: base });
      setBaseUrl(base ?? '');
      setMessage(fa.settings.saved);
    } catch {
      setFailed(true);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <h2>{fa.settings.scheduleTitle}</h2>
      <p className="muted">{fa.settings.scheduleHint}</p>
      <div className="field">
        <label htmlFor="st-calendar">{fa.settings.calendar}</label>
        <select
          id="st-calendar"
          value={calendar}
          onChange={(e) => setCalendar(e.target.value as AppSettings['calendar'])}
        >
          <option value="persian">{fa.settings.calendarOption.persian}</option>
          <option value="gregorian">{fa.settings.calendarOption.gregorian}</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="st-tz">{fa.settings.timeZone}</label>
        <input
          id="st-tz"
          list="st-tz-list"
          dir="ltr"
          value={timeZone}
          aria-invalid={tzError ? true : undefined}
          aria-describedby="st-tz-hint"
          onChange={(e) => setTimeZone(e.target.value)}
        />
        <datalist id="st-tz-list">
          {ZONES.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <small id="st-tz-hint" className={tzError ? 'field-error' : undefined}>
          {tzError ?? fa.settings.timeZoneHint}
        </small>
      </div>
      <div className="field">
        <label htmlFor="st-gap">{fa.settings.gapDays}</label>
        <input
          id="st-gap"
          type="number"
          inputMode="numeric"
          min={1}
          max={30}
          value={gap}
          aria-invalid={gapError ? true : undefined}
          aria-describedby={gapError ? 'st-gap-err' : undefined}
          onChange={(e) => setGap(e.target.value)}
        />
        {gapError && <small id="st-gap-err" className="field-error">{gapError}</small>}
      </div>
      <h2>{fa.settings.qrTitle}</h2>
      <div className="field">
        <label htmlFor="st-base">{fa.settings.baseUrl}</label>
        <input
          id="st-base"
          type="url"
          dir="ltr"
          inputMode="url"
          placeholder={window.location.origin}
          value={baseUrl}
          aria-invalid={baseUrlError ? true : undefined}
          aria-describedby="st-base-hint"
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <small id="st-base-hint" className={baseUrlError ? 'field-error' : undefined}>
          {baseUrlError ?? fa.settings.baseUrlHint(window.location.origin)}
        </small>
      </div>
      {baseWarnings.map((w) => (
        <p key={w} className="notice" role="note">{fa.settings.warn[w]}</p>
      ))}
      <p><Link to="/labels">{fa.qr.labels}</Link></p>
      {preview && <p aria-live="polite">{preview}</p>}
      {failed && <p role="alert" className="form-error">{fa.settings.saveFailed}</p>}
      {message && <p role="status" className="form-message">{message}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">{fa.settings.save}</button>
      </div>
    </form>
  );
}
