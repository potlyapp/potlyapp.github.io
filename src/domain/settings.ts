import { z } from 'zod';
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
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  timeZone: 'Asia/Tehran',
  calendar: 'persian',
  checkedMoistGapDays: 2,
  lastSeenSeason: null,
};

export const appSettingsPatchSchema = appSettingsSchema.partial();
export type AppSettingsPatch = z.input<typeof appSettingsPatchSchema>;
