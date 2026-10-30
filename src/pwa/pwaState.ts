import { useSyncExternalStore } from 'react';

/** Minimal shape of the `beforeinstallprompt` event (not in lib.dom). */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaState {
  needRefresh: boolean;
  offlineReady: boolean;
  installPrompt: InstallPromptEvent | null;
  installed: boolean;
}

const INITIAL: PwaState = { needRefresh: false, offlineReady: false, installPrompt: null, installed: false };

let state: PwaState = INITIAL;
let applyUpdate: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<PwaState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const pwaStore = {
  get: (): PwaState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setNeedRefresh: (needRefresh: boolean) => set({ needRefresh }),
  setOfflineReady: (offlineReady: boolean) => set({ offlineReady }),
  setInstallPrompt: (installPrompt: InstallPromptEvent | null) => set({ installPrompt }),
  setInstalled: (installed: boolean) => set({ installed }),
  setUpdater(fn: (() => Promise<void>) | null) {
    applyUpdate = fn;
  },
  async update(): Promise<void> {
    await applyUpdate?.();
  },
  reset(): void {
    applyUpdate = null;
    set(INITIAL);
  },
};

export function usePwaState(): PwaState {
  return useSyncExternalStore(pwaStore.subscribe, pwaStore.get, pwaStore.get);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
