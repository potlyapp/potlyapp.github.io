import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { eventsRepo } from '../data/events';
import { fa } from '../i18n/fa';

interface Last {
  label: string;
  eventIds: string[];
}

interface UndoApi {
  /** Remember the most recent action (one or several events) so it can be undone. */
  push: (label: string, eventIds: string[]) => void;
}

const UndoContext = createContext<UndoApi>({ push: () => {} });

export function useUndo(): UndoApi {
  return useContext(UndoContext);
}

export function UndoProvider({ children }: { children: ReactNode }) {
  const [last, setLast] = useState<Last | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const push = useCallback((label: string, eventIds: string[]) => {
    setMessage(null);
    setLast(eventIds.length > 0 ? { label, eventIds } : null);
  }, []);
  const api = useMemo(() => ({ push }), [push]);

  async function undo() {
    if (!last) return;
    try {
      for (const id of last.eventIds) await eventsRepo.undo(id);
      setMessage(fa.undo.done);
    } catch {
      setMessage(fa.undo.failed);
    }
    setLast(null);
  }

  return (
    <UndoContext.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="undo-bar-region">
        {(last || message) && (
          <div className="undo-bar">
            <span>{last ? fa.undo.recorded(last.label) : message}</span>
            {last && (
              <button type="button" className="btn" onClick={undo}>
                {fa.undo.button}
              </button>
            )}
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setLast(null);
                setMessage(null);
              }}
            >
              {fa.undo.dismiss}
            </button>
          </div>
        )}
      </div>
    </UndoContext.Provider>
  );
}
