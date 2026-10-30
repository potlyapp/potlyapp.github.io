import { useState } from 'react';
import { settingsRepo } from '../../data/settings';
import type { AppSettings } from '../../domain/settings';
import { fa } from '../../i18n/fa';
import { notificationPermission, requestNotificationPermission } from '../../pwa/notifications';

type Status = { kind: 'ok' | 'error'; text: string } | null;

export function NotificationsSection({ settings }: { settings: AppSettings }) {
  const [status, setStatus] = useState<Status>(null);
  const [permission, setPermission] = useState(notificationPermission);
  const unsupported = permission === 'unsupported';
  const checked = settings.notificationsEnabled && permission === 'granted';

  async function toggle(next: boolean) {
    setStatus(null);
    try {
      if (next) {
        const result = permission === 'granted' ? 'granted' : await requestNotificationPermission();
        setPermission(result);
        if (result !== 'granted') {
          setStatus({ kind: 'error', text: result === 'unsupported' ? fa.notifications.unsupported : fa.notifications.denied });
          await settingsRepo.update({ notificationsEnabled: false });
          return;
        }
      }
      await settingsRepo.update({ notificationsEnabled: next });
      setStatus({ kind: 'ok', text: next ? fa.notifications.enabled : fa.notifications.disabled });
    } catch {
      setStatus({ kind: 'error', text: fa.notifications.failed });
    }
  }

  return (
    <section aria-labelledby="notif-title" className="settings-section">
      <h2 id="notif-title">{fa.notifications.sectionTitle}</h2>
      <p className="muted">{fa.notifications.limits}</p>
      {unsupported ? (
        <p className="notice" role="note">{fa.notifications.unsupported}</p>
      ) : (
        <>
          <label className="check">
            <input type="checkbox" checked={checked} onChange={(e) => void toggle(e.target.checked)} />
            {fa.notifications.toggle}
          </label>
          {permission === 'denied' && <p className="notice" role="note">{fa.notifications.denied}</p>}
        </>
      )}
      {status && (
        <p role={status.kind === 'error' ? 'alert' : 'status'} className={status.kind === 'error' ? 'form-error' : 'form-message'}>
          {status.text}
        </p>
      )}
    </section>
  );
}
