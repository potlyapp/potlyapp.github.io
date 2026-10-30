import type { Season } from './schemas';

export type Calendar = 'persian' | 'gregorian';

const formatters = new Map<string, Intl.DateTimeFormat>();

function monthOf(instant: number, timeZone: string, calendar: Calendar): number {
  const key = `${calendar}|${timeZone}`;
  let f = formatters.get(key);
  if (!f) {
    const locale = calendar === 'persian' ? 'en-u-ca-persian' : 'en-u-ca-gregory';
    f = new Intl.DateTimeFormat(locale, { timeZone, month: 'numeric' });
    formatters.set(key, f);
  }
  const part = f.formatToParts(instant).find((p) => p.type === 'month');
  return Number(part?.value);
}

/**
 * Persian: spring Farvardin–Khordad (months 1–3), summer 4–6, autumn 7–9, winter 10–12.
 * Gregorian: meteorological seasons, northern hemisphere.
 */
export function seasonFor(instant: number, timeZone: string, calendar: Calendar = 'persian'): Season {
  const month = monthOf(instant, timeZone, calendar);
  if (calendar === 'persian') {
    if (month <= 3) return 'spring';
    if (month <= 6) return 'summer';
    if (month <= 9) return 'autumn';
    return 'winter';
  }
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}
