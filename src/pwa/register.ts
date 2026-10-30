import { registerSW } from 'virtual:pwa-register';
import { pwaStore, isStandalone, type InstallPromptEvent } from './pwaState';

/** Imported only from `main.tsx` so tests never touch the virtual module. */
export function registerPwa(): void {
  pwaStore.setInstalled(isStandalone());

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pwaStore.setInstallPrompt(e as InstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => {
    pwaStore.setInstallPrompt(null);
    pwaStore.setInstalled(true);
  });

  const updateSW = registerSW({
    onNeedRefresh: () => pwaStore.setNeedRefresh(true),
    onOfflineReady: () => pwaStore.setOfflineReady(true),
  });
  pwaStore.setUpdater(() => updateSW(true));
}
