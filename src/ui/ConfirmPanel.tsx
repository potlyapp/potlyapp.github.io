import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Inline confirmation. Focus starts on Cancel so an accidental Enter never confirms. */
export function ConfirmPanel({ title, children, confirmLabel, cancelLabel, danger, busy, onConfirm, onCancel }: Props) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div role="alertdialog" aria-labelledby={titleId} className={`confirm${danger ? ' confirm-danger' : ''}`}>
      <h2 id={titleId}>{title}</h2>
      {children}
      <div className="form-actions">
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="btn" ref={cancelRef} onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
