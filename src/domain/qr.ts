import { isValidId } from './id';

/**
 * Normalises user input to a bare origin (`https://host[:port]`), or returns null when it is not a
 * usable http(s) URL. Paths, queries and fragments are dropped: the app is served from `/`.
 */
export function normalizeBaseUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.hostname) return null;
  return url.origin;
}

/** The only thing a QR code carries: an absolute URL with the unguessable plant ID. */
export function plantUrl(baseUrl: string, plantId: string): string {
  if (!isValidId(plantId)) throw new Error('invalid plant id');
  return `${baseUrl.replace(/\/+$/, '')}/p/${plantId}`;
}

export type BaseUrlWarning = 'local_host' | 'insecure' | 'origin_mismatch';

function isLocalHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]' || hostname.endsWith('.local')) return true;
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(hostname);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** Reasons a printed label might not open the plant once it leaves this device/session. */
export function baseUrlWarnings(baseUrl: string, currentOrigin: string): BaseUrlWarning[] {
  const out: BaseUrlWarning[] = [];
  const url = new URL(baseUrl);
  if (isLocalHost(url.hostname)) out.push('local_host');
  else if (url.protocol === 'http:') out.push('insecure');
  if (url.origin !== currentOrigin) out.push('origin_mismatch');
  return out;
}
