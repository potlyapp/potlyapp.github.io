import { pwaStore } from './pwaState';

describe('pwaStore', () => {
  afterEach(() => pwaStore.reset());

  it('starts empty', () => {
    expect(pwaStore.get()).toEqual({ needRefresh: false, offlineReady: false, installPrompt: null, installed: false });
  });

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const listener = vi.fn();
    const off = pwaStore.subscribe(listener);
    pwaStore.setNeedRefresh(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(pwaStore.get().needRefresh).toBe(true);
    off();
    pwaStore.setOfflineReady(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('runs the registered updater, and is a no-op without one', async () => {
    await expect(pwaStore.update()).resolves.toBeUndefined();
    const updater = vi.fn(() => Promise.resolve());
    pwaStore.setUpdater(updater);
    await pwaStore.update();
    expect(updater).toHaveBeenCalledTimes(1);
  });

  it('reset clears state and updater', async () => {
    const updater = vi.fn(() => Promise.resolve());
    pwaStore.setUpdater(updater);
    pwaStore.setInstalled(true);
    pwaStore.reset();
    expect(pwaStore.get().installed).toBe(false);
    await pwaStore.update();
    expect(updater).not.toHaveBeenCalled();
  });
});
