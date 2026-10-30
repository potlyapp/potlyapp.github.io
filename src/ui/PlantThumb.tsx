import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { photosRepo } from '../data/photo';

export function PlantThumb({ plantId, large = false }: { plantId: string; large?: boolean }) {
  const photo = useLiveQuery(() => photosRepo.get(plantId), [plantId]);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) return;
    const objectUrl = URL.createObjectURL(photo.blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with an external, revocable resource
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [photo]);

  const cls = `thumb${large ? ' thumb-large' : ''}`;
  if (!url) return <span className={`${cls} thumb-empty`} aria-hidden="true" />;
  return <img className={cls} src={url} alt="" />;
}
