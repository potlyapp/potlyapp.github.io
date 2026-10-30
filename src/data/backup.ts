import { BACKUP_FORMAT, BACKUP_VERSION, type Backup, type BackupPhoto } from '../domain/backup';
import { deriveCaches } from '../domain/events';
import type { Plant } from '../domain/schemas';
import { db as defaultDb, type PotlyDb } from './db';
import { createSettingsRepo } from './settings';

export type ImportMode = 'replace' | 'merge';

export interface ImportSummary {
  mode: ImportMode;
  plantsAdded: number;
  plantsUpdated: number;
  plantsKept: number;
  eventsAdded: number;
  photosWritten: number;
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read photo'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(data: string, mime: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function createBackupRepo(db: PotlyDb = defaultDb, clock: () => number = Date.now) {
  const settingsRepo = createSettingsRepo(db);

  return {
    async export(): Promise<Backup> {
      const [settings, plants, events, photoRows] = await Promise.all([
        settingsRepo.get(),
        db.plants.toArray(),
        db.events.toArray(),
        db.photos.toArray(),
      ]);
      const plantIds = new Set(plants.map((p) => p.id));
      const photos: BackupPhoto[] = [];
      for (const row of photoRows) {
        if (!plantIds.has(row.plantId)) continue;
        photos.push({
          plantId: row.plantId,
          mime: ALLOWED_MIME.includes(row.blob.type) ? row.blob.type : 'image/jpeg',
          width: row.width,
          height: row.height,
          updatedAt: row.updatedAt,
          data: await blobToBase64(row.blob),
        });
      }
      return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: clock(),
        settings,
        plants: plants.sort((a, b) => a.createdAt - b.createdAt),
        events: events.sort((a, b) => a.at - b.at),
        photos,
      };
    },

    /**
     * Applies an already-validated backup in one transaction: any failure leaves existing data untouched.
     * `replace` swaps everything for the file. `merge` keeps current settings and history, adds what is
     * missing, and for a plant present in both keeps the more recently edited version.
     */
    async import(backup: Backup, mode: ImportMode): Promise<ImportSummary> {
      const decoded = backup.photos.map((p) => ({
        plantId: p.plantId,
        blob: base64ToBlob(p.data, p.mime),
        width: p.width,
        height: p.height,
        updatedAt: p.updatedAt,
      }));
      const summary: ImportSummary = {
        mode,
        plantsAdded: 0,
        plantsUpdated: 0,
        plantsKept: 0,
        eventsAdded: 0,
        photosWritten: 0,
      };

      await db.transaction('rw', db.plants, db.photos, db.events, db.settings, async () => {
        if (mode === 'replace') {
          await Promise.all([db.plants.clear(), db.photos.clear(), db.events.clear(), db.settings.clear()]);
          await db.settings.put({ key: 'app', ...backup.settings });
          await db.plants.bulkPut(backup.plants);
          await db.events.bulkPut(backup.events);
          await db.photos.bulkPut(decoded);
          summary.plantsAdded = backup.plants.length;
          summary.eventsAdded = backup.events.length;
          summary.photosWritten = decoded.length;
        } else {
          for (const incoming of backup.plants) {
            const existing = await db.plants.get(incoming.id);
            if (!existing) {
              await db.plants.add(incoming);
              summary.plantsAdded++;
            } else if (incoming.updatedAt > existing.updatedAt) {
              await db.plants.put(incoming);
              summary.plantsUpdated++;
            } else summary.plantsKept++;
          }
          const known = new Set(await db.events.toCollection().primaryKeys());
          const fresh = backup.events.filter((e) => !known.has(e.id));
          await db.events.bulkAdd(fresh);
          summary.eventsAdded = fresh.length;
          for (const photo of decoded) {
            const existing = await db.photos.get(photo.plantId);
            if (!existing || photo.updatedAt > existing.updatedAt) {
              await db.photos.put(photo);
              summary.photosWritten++;
            }
          }
        }

        // Caches are derived from history, so recompute them rather than trusting the file.
        const plants: Plant[] = await db.plants.toArray();
        for (const plant of plants) {
          const events = await db.events.where('plantId').equals(plant.id).toArray();
          await db.plants.update(plant.id, deriveCaches(events));
        }
      });
      return summary;
    },
  };
}

export const backupRepo = createBackupRepo();
