const ID_BYTES = 16;

export const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function newId(): string {
  const bytes = new Uint8Array(ID_BYTES);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isValidId(value: string): boolean {
  return ID_PATTERN.test(value);
}
