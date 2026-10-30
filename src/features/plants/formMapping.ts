import { downscaleImage, photosRepo } from '../../data/photo';
import type { Plant, PlantInput } from '../../domain/schemas';
import type { PlantFormValues } from './PlantForm';

export function valuesToInput(v: PlantFormValues): PlantInput {
  const size = v.potSizeCm.trim() === '' ? null : Number(v.potSizeCm);
  return {
    name: v.name,
    species: v.species,
    room: v.room,
    light: v.light,
    potMaterial: v.potMaterial,
    potSizeCm: size !== null && Number.isFinite(size) && size > 0 ? size : null,
    soil: v.soil,
    notes: v.notes,
  };
}

export function plantToValues(p: Plant): PlantFormValues {
  return {
    name: p.name,
    species: p.species ?? '',
    room: p.room ?? '',
    light: p.light,
    potMaterial: p.potMaterial,
    potSizeCm: p.potSizeCm === null ? '' : String(p.potSizeCm),
    soil: p.soil,
    notes: p.notes,
  };
}

/** Returns false when the photo could not be processed (plant itself is still saved). */
export async function applyPhoto(plantId: string, photo: File | null, removePhoto: boolean): Promise<boolean> {
  if (removePhoto) await photosRepo.remove(plantId);
  if (!photo) return true;
  try {
    const { blob, width, height } = await downscaleImage(photo);
    await photosRepo.set(plantId, blob, width, height);
    return true;
  } catch {
    return false;
  }
}
