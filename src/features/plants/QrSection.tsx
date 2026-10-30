import { useState } from 'react';
import { Link } from 'react-router-dom';
import { plantUrl } from '../../domain/qr';
import type { Plant } from '../../domain/schemas';
import { fa } from '../../i18n/fa';
import { QrCode, qrPngDataUrl, qrSvg } from '../../ui/QrCode';
import { useBaseUrl } from '../../ui/useBaseUrl';

function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
}

export function QrSection({ plant }: { plant: Plant }) {
  const info = useBaseUrl();
  const [error, setError] = useState(false);
  if (!info) return null;
  const url = plantUrl(info.baseUrl, plant.id);

  async function save(kind: 'svg' | 'png') {
    setError(false);
    try {
      if (kind === 'png') {
        download(await qrPngDataUrl(url, 1024), `potly-${plant.id}.png`);
        return;
      }
      const blob = new Blob([await qrSvg(url)], { type: 'image/svg+xml' });
      const href = URL.createObjectURL(blob);
      download(href, `potly-${plant.id}.svg`);
      URL.revokeObjectURL(href);
    } catch {
      setError(true);
    }
  }

  return (
    <>
      <h2>{fa.qr.title}</h2>
      <div className="qr-block">
        <QrCode text={url} alt={fa.qr.alt(plant.name)} />
        <div>
          <p className="muted qr-url" dir="ltr">{url}</p>
          <p className="muted">{fa.qr.onlyId}</p>
          <p className="notice">{fa.qr.localOnly}</p>
          {info.warnings.map((w) => (
            <p key={w} className="notice" role="note">{fa.settings.warn[w]}</p>
          ))}
          {error && <p role="alert" className="form-error">{fa.qr.failed}</p>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => void save('svg')}>{fa.qr.downloadSvg}</button>
            <button type="button" className="btn" onClick={() => void save('png')}>{fa.qr.downloadPng}</button>
            <Link to="/labels" className="btn btn-quiet">{fa.qr.labels}</Link>
          </div>
        </div>
      </div>
    </>
  );
}
