import {
  appSettingsPatchSchema,
  appSettingsSchema,
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type AppSettingsPatch,
} from '../domain/settings';
import type { Season } from '../domain/schemas';
import { db as defaultDb, type PotlyDb } from './db';

const KEY = 'app';

export function createSettingsRepo(db: PotlyDb = defaultDb) {
  async function read(): Promise<AppSettings> {
    const row = await db.settings.get(KEY);
    if (!row) return { ...DEFAULT_APP_SETTINGS };
    const parsed = appSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, ...row });
    return parsed.success ? parsed.data : { ...DEFAULT_APP_SETTINGS };
  }

  return {
    /** Stored settings merged over defaults; a corrupt row falls back to defaults. */
    get: read,

    async update(patch: AppSettingsPatch): Promise<AppSettings> {
      const parsed = appSettingsPatchSchema.parse(patch);
      const defined = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined));
      const next = appSettingsSchema.parse({ ...(await read()), ...defined });
      await db.settings.put({ key: KEY, ...next });
      return next;
    },

    async markSeasonSeen(season: Season): Promise<void> {
      await this.update({ lastSeenSeason: season });
    },
  };
}

export const settingsRepo = createSettingsRepo();
