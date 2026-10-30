import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { checkStorage } from '../../data/db';
import { photosRepo } from '../../data/photo';
import { plantsRepo } from '../../data/plants';
import { fa } from '../../i18n/fa';

function PlantThumb({ plantId }: { plantId: string }) {
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

  if (!url) return <span className="thumb thumb-empty" aria-hidden="true" />;
  return <img className="thumb" src={url} alt="" />;
}

export function PlantsPage() {
  const plants = useLiveQuery(() => plantsRepo.list(), []);
  const [storageOk, setStorageOk] = useState(true);

  useEffect(() => {
    checkStorage().then(setStorageOk);
  }, []);

  return (
    <section aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">{fa.plants.title}</h1>
        <Link to="/plants/new" className="btn btn-primary">{fa.plants.add}</Link>
      </div>

      {!storageOk && <p role="alert" className="form-error">{fa.storage.unavailable}</p>}

      {plants && plants.length === 0 && (
        <div className="empty">
          <h2>{fa.plants.emptyTitle}</h2>
          <p>{fa.plants.emptyBody}</p>
        </div>
      )}

      {plants && plants.length > 0 && (
        <>
          <p className="muted">{fa.plants.count(plants.length)}</p>
          <ul className="plant-list">
            {plants.map((p) => (
              <li key={p.id}>
                <Link to={`/plants/${p.id}/edit`} className="plant-row">
                  <PlantThumb plantId={p.id} />
                  <span className="plant-row-text">
                    <strong>{p.name}</strong>
                    {(p.species || p.room) && (
                      <span className="muted">{[p.species, p.room].filter(Boolean).join(' · ')}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
