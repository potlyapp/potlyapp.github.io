const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, withTime: boolean): Intl.DateTimeFormat {
  const key = `${timeZone}|${withTime}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      timeZone,
      dateStyle: 'medium',
      ...(withTime ? { timeStyle: 'short' as const } : {}),
    });
    cache.set(key, f);
  }
  return f;
}

export function formatDateTime(instant: number, timeZone: string): string {
  return formatter(timeZone, true).format(instant);
}

export function formatDate(instant: number, timeZone: string): string {
  return formatter(timeZone, false).format(instant);
}
