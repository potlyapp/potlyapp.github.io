import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { demoRepo } from '../../data/demo';
import { fa } from '../../i18n/fa';
import { ConfirmPanel } from '../../ui/ConfirmPanel';

type Status = { kind: 'ok' | 'error'; text: string } | null;

export function DemoSection() {
  const count = useLiveQuery(() => demoRepo.count(), []);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function load() {
    setBusy(true);
    setStatus(null);
    try {
      await demoRepo.load();
      setStatus({ kind: 'ok', text: fa.demo.loaded });
    } catch {
      setStatus({ kind: 'error', text: fa.demo.failed });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setStatus(null);
    try {
      const n = await demoRepo.remove();
      setStatus({ kind: 'ok', text: fa.demo.removed(n) });
    } catch {
      setStatus({ kind: 'error', text: fa.demo.failed });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <section aria-labelledby="demo-title" className="settings-section">
      <h2 id="demo-title">{fa.demo.title}</h2>
      <p className="muted">{fa.demo.hint}</p>
      {count === undefined ? null : count > 0 ? (
        confirming ? (
          <ConfirmPanel
            title={fa.demo.confirmTitle}
            confirmLabel={fa.demo.confirm}
            cancelLabel={fa.demo.cancel}
            danger
            busy={busy}
            onConfirm={() => void remove()}
            onCancel={() => setConfirming(false)}
          >
            <p>{fa.demo.confirmBody}</p>
          </ConfirmPanel>
        ) : (
          <div className="form-actions">
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
              {fa.demo.remove(count)}
            </button>
          </div>
        )
      ) : (
        <div className="form-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => void load()}>
            {fa.demo.load}
          </button>
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
