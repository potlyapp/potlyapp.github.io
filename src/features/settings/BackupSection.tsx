import { useState, type ChangeEvent } from 'react';
import { backupRepo, type ImportMode } from '../../data/backup';
import { backupFileName, parseBackup, type Backup, type BackupError } from '../../domain/backup';
import { dayKey } from '../../domain/dayKey';
import type { AppSettings } from '../../domain/settings';
import { fa } from '../../i18n/fa';
import { ConfirmPanel } from '../../ui/ConfirmPanel';
import { downloadBlob } from '../../ui/download';

type Status = { kind: 'ok' | 'error'; text: string } | null;

export function BackupSection({ settings }: { settings: AppSettings }) {
  const [status, setStatus] = useState<Status>(null);
  const [errors, setErrors] = useState<BackupError[]>([]);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  async function exportBackup() {
    setStatus(null);
    try {
      const data = await backupRepo.export();
      const name = backupFileName(dayKey(Date.now(), settings.timeZone));
      downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), name);
      setStatus({ kind: 'ok', text: fa.backup.exported(name) });
    } catch {
      setStatus({ kind: 'error', text: fa.backup.exportFailed });
    }
  }

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setStatus(null);
    setErrors([]);
    setBackup(null);
    setConfirming(false);
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setErrors([{ code: 'not_json' }]);
      return;
    }
    const result = parseBackup(text);
    if (result.ok) setBackup(result.backup);
    else setErrors(result.errors);
  }

  async function runImport() {
    if (!backup) return;
    setBusy(true);
    setStatus(null);
    try {
      const s = await backupRepo.import(backup, mode);
      setStatus({ kind: 'ok', text: fa.backup.done(s.plantsAdded, s.plantsUpdated, s.eventsAdded) });
      setBackup(null);
      setFileKey((k) => k + 1);
    } catch {
      setStatus({ kind: 'error', text: fa.backup.failed });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  function startImport() {
    if (mode === 'replace') setConfirming(true);
    else void runImport();
  }

  return (
    <section aria-labelledby="backup-title" className="settings-section">
      <h2 id="backup-title">{fa.backup.title}</h2>
      <p className="muted">{fa.backup.hint}</p>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={() => void exportBackup()}>
          {fa.backup.export}
        </button>
      </div>

      <div className="field">
        <label htmlFor="backup-file">{fa.backup.file}</label>
        <input key={fileKey} id="backup-file" type="file" accept="application/json,.json" onChange={(e) => void pickFile(e)} />
      </div>

      {errors.length > 0 && (
        <div role="alert" className="form-error">
          <p>{fa.backup.invalidTitle}</p>
          <ul>
            {errors.map((err, i) => (
              <li key={i}>
                {fa.backup.errors[err.code]}
                {err.path && <span dir="ltr"> ({err.path})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {backup && (
        <div>
          <p role="status">{fa.backup.preview(backup.plants.length, backup.events.length, backup.photos.length)}</p>
          <fieldset className="field">
            <legend>{fa.backup.modeLegend}</legend>
            <label className="check">
              <input type="radio" name="backup-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
              {fa.backup.merge}
            </label>
            <small>{fa.backup.mergeHint}</small>
            <label className="check">
              <input type="radio" name="backup-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              {fa.backup.replace}
            </label>
            <small>{fa.backup.replaceHint}</small>
          </fieldset>
          {confirming ? (
            <ConfirmPanel
              title={fa.backup.confirmTitle}
              confirmLabel={fa.backup.confirm}
              cancelLabel={fa.backup.cancel}
              danger
              busy={busy}
              onConfirm={() => void runImport()}
              onCancel={() => setConfirming(false)}
            >
              <p>{fa.backup.confirmBody}</p>
            </ConfirmPanel>
          ) : (
            <div className="form-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={startImport}>
                {fa.backup.import}
              </button>
            </div>
          )}
        </div>
      )}

      {status && (
        <p role={status.kind === 'error' ? 'alert' : 'status'} className={status.kind === 'error' ? 'form-error' : 'form-message'}>
          {status.text}
        </p>
      )}
    </section>
  );
}
