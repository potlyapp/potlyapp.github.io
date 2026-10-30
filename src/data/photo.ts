import type { Photo } from '../domain/schemas';
import { db as defaultDb, type PotlyDb } from './db';

export const MAX_PHOTO_EDGE = 1024;
const JPEG_QUALITY = 0.82;

export function scaledSize(width: number, height: number, maxEdge = MAX_PHOTO_EDGE) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export async function downscaleImage(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encode failed'))), 'image/jpeg', JPEG_QUALITY),
    );
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}

export function createPhotosRepo(db: PotlyDb = defaultDb, clock: () => number = Date.now) {
  return {
    async set(plantId: string, blob: Blob, width: number, height: number): Promise<void> {
      const photo: Photo = { plantId, blob, width, height, updatedAt: clock() };
      await db.photos.put(photo);
    },
    async get(plantId: string): Promise<Photo | undefined> {
      return db.photos.get(plantId);
    },
    async remove(plantId: string): Promise<void> {
      await db.photos.delete(plantId);
    },
  };
}

export const photosRepo = createPhotosRepo();
