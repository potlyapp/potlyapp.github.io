import { z } from 'zod';
import { careEventSchema } from './events';
import { plantSchema } from './schemas';
import { appSettingsSchema } from './settings';

export const BACKUP_FORMAT = 'potly-backup';
export const BACKUP_VERSION = 1;

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export const backupPhotoSchema = z.object({
  plantId: plantSchema.shape.id,
  mime: z.string().regex(/^image\/(jpeg|png|webp)$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  updatedAt: z.number().int(),
  data: z.string().regex(BASE64),
});
export type BackupPhoto = z.infer<typeof backupPhotoSchema>;

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number().int(),
  settings: appSettingsSchema,
  plants: z.array(plantSchema),
  events: z.array(careEventSchema),
  photos: z.array(backupPhotoSchema),
});
export type Backup = z.infer<typeof backupSchema>;

export type BackupErrorCode =
  | 'not_json'
  | 'not_backup'
  | 'newer_version'
  | 'invalid'
  | 'duplicate_plant'
  | 'duplicate_event'
  | 'duplicate_photo'
  | 'orphan_event'
  | 'orphan_photo'
  | 'bad_undo';

export interface BackupError {
  code: BackupErrorCode;
  /** Where it went wrong, e.g. `plants[3].name`. */
  path?: string;
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; errors: BackupError[] };

const MAX_REPORTED = 20;

/** Parses and fully validates backup text. Nothing is accepted unless the whole file is consistent. */
export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ code: 'not_json' }] };
  }
  if (typeof json !== 'object' || json === null || (json as { format?: unknown }).format !== BACKUP_FORMAT) {
    return { ok: false, errors: [{ code: 'not_backup' }] };
  }
  const version = (json as { version?: unknown }).version;
  if (typeof version === 'number' && version > BACKUP_VERSION) {
    return { ok: false, errors: [{ code: 'newer_version' }] };
  }

  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, MAX_REPORTED).map((i) => ({ code: 'invalid' as const, path: formatPath(i.path) })),
    };
  }

  const errors = integrityErrors(parsed.data);
  return errors.length ? { ok: false, errors: errors.slice(0, MAX_REPORTED) } : { ok: true, backup: parsed.data };
}

function formatPath(path: ReadonlyArray<PropertyKey>): string {
  return path.reduce<string>((acc, part) => (typeof part === 'number' ? `${acc}[${part}]` : acc ? `${acc}.${String(part)}` : String(part)), '');
}

function integrityErrors(b: Backup): BackupError[] {
  const errors: BackupError[] = [];
  const plantIds = new Set<string>();
  b.plants.forEach((p, i) => {
    if (plantIds.has(p.id)) errors.push({ code: 'duplicate_plant', path: `plants[${i}]` });
    plantIds.add(p.id);
  });

  const eventsById = new Map<string, Backup['events'][number]>();
  b.events.forEach((e, i) => {
    if (eventsById.has(e.id)) errors.push({ code: 'duplicate_event', path: `events[${i}]` });
    eventsById.set(e.id, e);
    if (!plantIds.has(e.plantId)) errors.push({ code: 'orphan_event', path: `events[${i}]` });
  });
  b.events.forEach((e, i) => {
    if (e.kind !== 'undo' || !e.undoesId) return;
    const target = eventsById.get(e.undoesId);
    if (!target || target.plantId !== e.plantId || target.kind === 'undo') {
      errors.push({ code: 'bad_undo', path: `events[${i}]` });
    }
  });

  const photoIds = new Set<string>();
  b.photos.forEach((ph, i) => {
    if (photoIds.has(ph.plantId)) errors.push({ code: 'duplicate_photo', path: `photos[${i}]` });
    photoIds.add(ph.plantId);
    if (!plantIds.has(ph.plantId)) errors.push({ code: 'orphan_photo', path: `photos[${i}]` });
  });
  return errors;
}

export function backupFileName(day: string): string {
  return `potly-backup-${day}.json`;
}
