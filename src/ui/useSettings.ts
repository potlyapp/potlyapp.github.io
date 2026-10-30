import { useLiveQuery } from 'dexie-react-hooks';
import { settingsRepo } from '../data/settings';
import type { AppSettings } from '../domain/settings';

/** Live app settings; `undefined` until the first read completes. */
export function useSettings(): AppSettings | undefined {
  return useLiveQuery(() => settingsRepo.get(), []);
}
