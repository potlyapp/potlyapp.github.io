import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { photosRepo } from '../../data/photo';
import { plantsRepo } from '../../data/plants';
import type { Plant } from '../../domain/schemas';
import { fa } from '../../i18n/fa';
import { PlantForm, type PlantFormSubmit } from './PlantForm';
import { applyPhoto, plantToValues, valuesToInput } from './formMapping';

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; plant: Plant; hasPhoto: boolean };

export function EditPlantPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const plant = await plantsRepo.get(id);
        const photo = plant ? await photosRepo.get(id) : undefined;
        if (!cancelled) setLoad(plant ? { state: 'ready', plant, hasPhoto: !!photo } : { state: 'missing' });
      } catch {
        if (!cancelled) setLoad({ state: 'missing' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit({ values, photo, removePhoto }: PlantFormSubmit): Promise<boolean> {
    setError(null);
    try {
      await plantsRepo.update(id, valuesToInput(values));
      await applyPhoto(id, photo, removePhoto);
      navigate('/plants');
      return true;
    } catch {
      setError(fa.form.saveFailed);
      return false;
    }
  }

  if (load.state === 'loading') return null;
  if (load.state === 'missing') {
    return (
      <section aria-labelledby="page-title">
        <h1 id="page-title">{fa.form.notFound}</h1>
        <Link to="/plants">{fa.plants.title}</Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{fa.form.editTitle}</h1>
      <PlantForm
        initial={plantToValues(load.plant)}
        hasExistingPhoto={load.hasPhoto}
        error={error}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/plants')}
      />
    </section>
  );
}
