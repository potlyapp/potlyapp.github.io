import { z } from 'zod';
import { normalizeBaseUrl } from './qr';
import { seasonSchema } from './schemas';

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const appSettingsSchema = z.object({
  timeZone: z.string().trim().min(1).refine(isValidTimeZone, 'invalid time zone'),
  calendar: z.enum(['persian', 'gregorian']),
  checkedMoistGapDays: z.number().int().min(1).max(30),
  /** Season the user has already been told about; drives the season-change banner. */
  lastSeenSeason: seasonSchema.nullable(),
  /** Origin encoded in QR codes. `null` means "the origin this app is running on". */
  baseUrl: z
    .string()
    .nullable()
    .refine((v) => v === null || normalizeBaseUrl(v) === v, 'invalid base URL'),
  /** Opt-in reminder notification while the app is open. Needs browser permission too. */
  notificationsEnabled: z.boolean(),
  /** Day key of the last reminder shown, so it fires at most once per day. */
  lastNotifiedDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  timeZone: 'Asia/Tehran',
  calendar: 'persian',
  checkedMoistGapDays: 2,
  lastSeenSeason: null,
  baseUrl: null,
  notificationsEnabled: false,
  lastNotifiedDay: null,
};

export const appSettingsPatchSchema = appSettingsSchema.partial();
export type AppSettingsPatch = z.input<typeof appSettingsPatchSchema>;
