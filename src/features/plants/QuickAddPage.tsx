import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { plantsRepo } from '../../data/plants';
import { fa } from '../../i18n/fa';
import { PlantForm, type PlantFormSubmit } from './PlantForm';
import { applyPhoto, valuesToInput } from './formMapping';

export function QuickAddPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit({ values, photo, again }: PlantFormSubmit): Promise<boolean> {
    setError(null);
    setMessage(null);
    try {
      const plant = await plantsRepo.create(valuesToInput(values));
      const photoOk = await applyPhoto(plant.id, photo, false);
      if (again) {
        const saved = fa.form.saved(plant.name);
        setMessage(photoOk ? saved : `${saved} ${fa.form.photoFailed}`);
      } else {
        navigate('/plants');
      }
      return true;
    } catch {
      setError(fa.form.saveFailed);
      return false;
    }
  }

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title">{fa.form.quickAddTitle}</h1>
      <PlantForm
        allowAddAnother
        error={error}
        message={message}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/plants')}
      />
    </section>
  );
}
