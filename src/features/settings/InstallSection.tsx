import { useEffect, useState } from 'react';
import { fa } from '../../i18n/fa';
import { isIos, pwaStore, usePwaState } from '../../pwa/pwaState';
import { persistState, type PersistState } from '../../pwa/storage';

export function InstallSection() {
  const { installPrompt, installed } = usePwaState();
  const [persist, setPersist] = useState<PersistState | null>(null);

  useEffect(() => {
    let live = true;
    void persistState().then((s) => {
      if (live) setPersist(s);
    });
    return () => {
      live = false;
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    pwaStore.setInstallPrompt(null);
  }

  return (
    <section aria-labelledby="install-title" className="settings-section">
      <h2 id="install-title">{fa.pwa.installTitle}</h2>
      {installed ? (
        <p>{fa.pwa.installed}</p>
      ) : installPrompt ? (
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={() => void install()}>
            {fa.pwa.install}
          </button>
        </div>
      ) : (
        <p className="muted">{isIos() ? fa.pwa.installIos : fa.pwa.installOther}</p>
      )}
      <h3>{fa.pwa.storageTitle}</h3>
      {persist && (
        <p className="muted">
          {persist === 'persisted' ? fa.pwa.persisted : persist === 'not_persisted' ? fa.pwa.notPersisted : fa.pwa.persistUnknown}
        </p>
      )}
    </section>
  );
}
