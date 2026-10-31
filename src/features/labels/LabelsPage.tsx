import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { plantsRepo } from '../../data/plants';
import { plantUrl } from '../../domain/qr';
import { fa } from '../../i18n/fa';
import { QrCode } from '../../ui/QrCode';
import { useBaseUrl } from '../../ui/useBaseUrl';

export function LabelsPage() {
  const plants = useLiveQuery(() => plantsRepo.list(), []);
  const info = useBaseUrl();
  if (!plants || !info) return null;

  return (
    <section aria-labelledby="page-title">
      <div className="page-head no-print">
        <h1 id="page-title">{fa.labels.title}</h1>
        <button type="button" className="btn btn-primary" disabled={plants.length === 0} onClick={() => window.print()}>
          {fa.labels.print}
        </button>
      </div>
      <div className="no-print">
        <p className="muted">{fa.labels.intro}</p>
        <p className="notice">{fa.qr.localOnly}</p>
        {info.warnings.map((w) => (
          <p key={w} className="notice" role="note">{fa.settings.warn[w]}</p>
        ))}
        <p className="muted" aria-live="polite">{fa.labels.count(plants.length)}</p>
        <Link to="/settings" className="btn btn-quiet">{fa.labels.back}</Link>
      </div>

      {plants.length === 0 ? (
        <p>{fa.labels.empty}</p>
      ) : (
        <ul className="label-sheet" role="list" aria-label={fa.labels.title}>
          {plants.map((p) => (
            <li key={p.id} className="label">
              <QrCode text={plantUrl(info.baseUrl, p.id)} alt={fa.qr.alt(p.name)} size={120} />
              <span className="label-name">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
