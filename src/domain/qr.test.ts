import { newId } from './id';
import { baseUrlWarnings, normalizeBaseUrl, plantUrl } from './qr';

describe('normalizeBaseUrl', () => {
  it('reduces to a bare origin', () => {
    expect(normalizeBaseUrl(' https://potlyapp.github.io/some/path?x=1#h ')).toBe('https://potlyapp.github.io');
    expect(normalizeBaseUrl('http://192.168.1.5:5173/')).toBe('http://192.168.1.5:5173');
  });

  it('rejects non-http(s) and garbage', () => {
    expect(normalizeBaseUrl('')).toBeNull();
    expect(normalizeBaseUrl('potlyapp.github.io')).toBeNull();
    expect(normalizeBaseUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeBaseUrl('ftp://example.com')).toBeNull();
  });
});

describe('plantUrl', () => {
  it('carries only the origin and the unguessable id', () => {
    const id = newId();
    expect(plantUrl('https://potlyapp.github.io', id)).toBe(`https://potlyapp.github.io/p/${id}`);
    expect(plantUrl('https://potlyapp.github.io/', id)).toBe(`https://potlyapp.github.io/p/${id}`);
  });

  it('refuses ids that are not random 128-bit base64url', () => {
    expect(() => plantUrl('https://x.test', '1')).toThrow();
    expect(() => plantUrl('https://x.test', 'پتوس')).toThrow();
    expect(() => plantUrl('https://x.test', '../etc')).toThrow();
  });
});

describe('baseUrlWarnings', () => {
  const live = 'https://potlyapp.github.io';

  it('is clean for the live origin', () => {
    expect(baseUrlWarnings(live, live)).toEqual([]);
  });

  it.each([
    'http://localhost:5173',
    'http://127.0.0.1:4173',
    'http://192.168.0.20:5173',
    'http://10.1.2.3',
    'http://172.20.0.1',
    'https://plants.local',
  ])('flags local host %s', (url) => {
    expect(baseUrlWarnings(url, url)).toEqual(['local_host']);
  });

  it('does not treat public 172.x outside the private range as local', () => {
    expect(baseUrlWarnings('https://172.32.0.1', 'https://172.32.0.1')).toEqual([]);
  });

  it('flags plain http on a public host', () => {
    expect(baseUrlWarnings('http://example.com', 'http://example.com')).toEqual(['insecure']);
  });

  it('flags a base URL that differs from the running origin', () => {
    expect(baseUrlWarnings(live, 'http://localhost:5173')).toEqual(['origin_mismatch']);
  });
});
