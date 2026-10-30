export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface NotifyInput {
  enabled: boolean;
  permission: NotificationPermissionState;
  today: string;
  lastNotifiedDay: string | null;
  dueCount: number;
}

/** At most one reminder per day, only when opted in, permitted, and something is due. */
export function shouldNotify(i: NotifyInput): boolean {
  return i.enabled && i.permission === 'granted' && i.dueCount > 0 && i.lastNotifiedDay !== i.today;
}
