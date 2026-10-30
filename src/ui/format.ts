import type { Calendar } from '../domain/season';

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, withTime: boolean, calendar: Calendar): Intl.DateTimeFormat {
  const key = `${timeZone}|${withTime}|${calendar}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(calendar === 'persian' ? 'fa-IR-u-ca-persian' : 'fa-IR-u-ca-gregory', {
      timeZone,
      dateStyle: 'medium',
      ...(withTime ? { timeStyle: 'short' as const } : {}),
    });
    cache.set(key, f);
  }
  return f;
}

export function formatDateTime(instant: number, timeZone: string, calendar: Calendar = 'persian'): string {
  return formatter(timeZone, true, calendar).format(instant);
}

export function formatDate(instant: number, timeZone: string, calendar: Calendar = 'persian'): string {
  return formatter(timeZone, false, calendar).format(instant);
}
