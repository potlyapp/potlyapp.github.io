import { useState, type ChangeEvent } from 'react';
import { plantsRepo } from '../../data/plants';
import { CSV_COLUMNS, csvTemplate, parsePlantCsv, type CsvParseResult } from '../../domain/csv';
import { fa } from '../../i18n/fa';
import { downloadBlob } from '../../ui/download';

type Status = { kind: 'ok' | 'error'; text: string } | null;

export function CsvImportSection() {
  const [result, setResult] = useState<CsvParseResult | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0);

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setStatus(null);
    setResult(null);
    if (!file) return;
    try {
      setResult(parsePlantCsv(await file.text()));
    } catch {
      setResult({ rows: [], errors: [{ row: 0, code: 'empty' }], ignoredColumns: [] });
    }
  }

  async function runImport() {
    if (!result || result.rows.length === 0) return;
    setBusy(true);
    setStatus(null);
    try {
      const created = await plantsRepo.createMany(result.rows.map((r) => r.input));
      setStatus({ kind: 'ok', text: fa.csv.done(created.length) });
      setResult(null);
      setFileKey((k) => k + 1);
    } catch {
      setStatus({ kind: 'error', text: fa.csv.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="csv-title" className="settings-section">
      <h2 id="csv-title">{fa.csv.title}</h2>
      <p className="muted">{fa.csv.hint}</p>
      <p dir="ltr" className="muted">{CSV_COLUMNS.join(', ')}</p>
      <div className="form-actions">
        <button
          type="button"
          className="btn"
          onClick={() => downloadBlob(new Blob([csvTemplate()], { type: 'text/csv;charset=utf-8' }), 'potly-plants-template.csv')}
        >
          {fa.csv.template}
        </button>
      </div>
      <div className="field">
        <label htmlFor="csv-file">{fa.csv.file}</label>
        <input key={fileKey} id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => void pickFile(e)} />
      </div>

      {result && (
        <div>
          <p role="status">
            {fa.csv.valid(result.rows.length)}
            {result.errors.length > 0 && ` · ${fa.csv.invalid(result.errors.length)}`}
          </p>
          {result.ignoredColumns.length > 0 && (
            <p className="muted" dir="auto">{fa.csv.ignored(result.ignoredColumns.join(', '))}</p>
          )}
          {result.errors.length > 0 && (
            <>
              <ul className="form-error">
                {result.errors.map((err, i) => (
                  <li key={i}>
                    {err.row === 0 ? fa.csv.wholeFile : fa.csv.row(err.row)}
                    {err.column && ` · ${fa.csv.columns[err.column]}`}
                    {` — ${fa.csv.errors[err.code]}`}
                  </li>
                ))}
              </ul>
              <p className="muted">{fa.csv.onlyValid}</p>
            </>
          )}
          {result.rows.length > 0 && (
            <div className="form-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void runImport()}>
                {fa.csv.import(result.rows.length)}
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
