export type PersistState = 'persisted' | 'not_persisted' | 'unknown';

/** Asks the browser not to evict this origin's data under storage pressure. Best effort. */
export async function requestPersist(): Promise<PersistState> {
  try {
    if (!navigator.storage?.persist) return 'unknown';
    if (await navigator.storage.persisted()) return 'persisted';
    return (await navigator.storage.persist()) ? 'persisted' : 'not_persisted';
  } catch {
    return 'unknown';
  }
}

export async function persistState(): Promise<PersistState> {
  try {
    if (!navigator.storage?.persisted) return 'unknown';
    return (await navigator.storage.persisted()) ? 'persisted' : 'not_persisted';
  } catch {
    return 'unknown';
  }
}
