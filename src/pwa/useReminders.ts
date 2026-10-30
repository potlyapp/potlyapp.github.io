import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { eventsRepo } from '../data/events';
import { plantsRepo } from '../data/plants';
import { settingsRepo } from '../data/settings';
import { dayKey } from '../domain/dayKey';
import { shouldNotify } from '../domain/notify';
import { computeTasks } from '../domain/tasks';
import { fa } from '../i18n/fa';
import { useNow } from '../ui/useNow';
import { useSettings } from '../ui/useSettings';
import { notificationPermission, showNotification } from './notifications';

/**
 * Shows one "check soil" reminder per day while the app is open. There is no background delivery:
 * without a push server a closed app cannot notify (documented in Settings).
 */
export function useReminders(): void {
  const plants = useLiveQuery(() => plantsRepo.list(), []);
  const events = useLiveQuery(() => eventsRepo.listAll(), []);
  const settings = useSettings();
  const now = useNow();

  const dueCount = useMemo(() => {
    if (!plants || !events || !settings) return null;
    return computeTasks(plants, events, now, settings).filter((t) => t.status !== 'upcoming').length;
  }, [plants, events, settings, now]);

  const today = settings ? dayKey(now, settings.timeZone) : null;
  const enabled = settings?.notificationsEnabled ?? false;
  const lastNotifiedDay = settings?.lastNotifiedDay ?? null;

  useEffect(() => {
    if (dueCount === null || today === null) return;
    const input = { enabled, permission: notificationPermission(), today, lastNotifiedDay, dueCount };
    if (!shouldNotify(input)) return;
    void settingsRepo
      .update({ lastNotifiedDay: today })
      .then(() => showNotification(fa.notifications.title, fa.notifications.body(dueCount)))
      .catch(() => undefined);
  }, [enabled, lastNotifiedDay, today, dueCount]);
}
