import { useEffect } from 'react';
import { settingsRepo } from '../../data/settings';
import { seasonFor } from '../../domain/season';
import type { Plant } from '../../domain/schemas';
import type { AppSettings } from '../../domain/settings';
import { fa } from '../../i18n/fa';

/**
 * Tells the user when the derived season changed since they last looked. The first ever run
 * records the current season silently. Nothing about plants or history changes here.
 */
export function SeasonBanner({
  settings,
  plants,
  now,
}: {
  settings: AppSettings;
  plants: readonly Plant[];
  now: number;
}) {
  const current = seasonFor(now, settings.timeZone, settings.calendar);
  const seen = settings.lastSeenSeason;

  useEffect(() => {
    if (seen === null) void settingsRepo.markSeasonSeen(current).catch(() => {});
  }, [seen, current]);

  if (seen === null || seen === current) return null;

  const missing = plants.filter(
    (p) =>
      p.archivedAt === null &&
      p.care[current].water.mode !== 'interval' &&
      p.care[current].fertilize.mode !== 'interval',
  ).length;

  return (
    <div className="notice season-banner" role="region" aria-label={fa.season.changedTitle(fa.seasons[seen], fa.seasons[current])}>
      <strong>{fa.season.changedTitle(fa.seasons[seen], fa.seasons[current])}</strong>
      <p>{fa.season.changedBody(fa.seasons[current])}</p>
      {missing > 0 && <p>{fa.season.missing(missing)}</p>}
      <button type="button" className="btn" onClick={() => void settingsRepo.markSeasonSeen(current)}>
        {fa.season.ack}
      </button>
    </div>
  );
}
