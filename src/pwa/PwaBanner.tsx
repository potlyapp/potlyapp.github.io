import { fa } from '../i18n/fa';
import { pwaStore, usePwaState } from './pwaState';

export function PwaBanner() {
  const { needRefresh, offlineReady } = usePwaState();
  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="pwa-banner" role="status">
      <span>{needRefresh ? fa.pwa.updateAvailable : fa.pwa.offlineReady}</span>
      <span className="pwa-banner-actions">
        {needRefresh && (
          <button type="button" className="btn btn-primary" onClick={() => void pwaStore.update()}>
            {fa.pwa.update}
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => {
            pwaStore.setNeedRefresh(false);
            pwaStore.setOfflineReady(false);
          }}
        >
          {fa.pwa.dismiss}
        </button>
      </span>
    </div>
  );
}
