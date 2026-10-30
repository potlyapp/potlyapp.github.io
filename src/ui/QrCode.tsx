import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { fa } from '../i18n/fa';

const OPTIONS = { errorCorrectionLevel: 'M', margin: 2 } as const;

export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { ...OPTIONS, type: 'svg' });
}

export function qrPngDataUrl(text: string, width = 512): Promise<string> {
  return QRCode.toDataURL(text, { ...OPTIONS, width });
}

/** Renders `text` as a QR image. The text itself is never shown; callers decide what to display. */
export function QrCode({ text, alt, size = 192 }: { text: string; alt: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    qrPngDataUrl(text, size * 2)
      .then((url) => {
        if (!live) return;
        setSrc(url);
        setFailed(false);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [text, size]);

  if (failed) return <p role="alert" className="form-error">{fa.qr.failed}</p>;
  if (!src) return <span className="qr qr-empty" style={{ inlineSize: size, blockSize: size }} aria-hidden="true" />;
  return <img className="qr" src={src} alt={alt} width={size} height={size} />;
}
