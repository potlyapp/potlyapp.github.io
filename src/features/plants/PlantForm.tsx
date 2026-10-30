import { useRef, useState, type FormEvent } from 'react';
import {
  LIGHT_VALUES,
  POT_MATERIAL_VALUES,
  SOIL_VALUES,
  type Light,
  type PotMaterial,
  type Soil,
} from '../../domain/schemas';
import { fa } from '../../i18n/fa';

export interface PlantFormValues {
  name: string;
  species: string;
  room: string;
  light: Light;
  potMaterial: PotMaterial;
  potSizeCm: string;
  soil: Soil;
  notes: string;
}

export const emptyFormValues: PlantFormValues = {
  name: '',
  species: '',
  room: '',
  light: 'unknown',
  potMaterial: 'unknown',
  potSizeCm: '',
  soil: 'unknown',
  notes: '',
};

export interface PlantFormSubmit {
  values: PlantFormValues;
  photo: File | null;
  removePhoto: boolean;
  again: boolean;
}

interface Props {
  initial?: PlantFormValues;
  hasExistingPhoto?: boolean;
  allowAddAnother?: boolean;
  error?: string | null;
  message?: string | null;
  /** Resolve `false` to signal failure: the form keeps its values. */
  onSubmit: (data: PlantFormSubmit) => Promise<boolean>;
  onCancel: () => void;
}

export function PlantForm({
  initial = emptyFormValues,
  hasExistingPhoto = false,
  allowAddAnother = false,
  error,
  message,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<PlantFormValues>(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set =
    <K extends keyof PlantFormValues>(key: K) =>
    (value: PlantFormValues[K]) =>
      setValues((v) => ({ ...v, [key]: value }));

  async function submit(again: boolean, e?: FormEvent) {
    e?.preventDefault();
    if (!values.name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    setNameError(false);
    setBusy(true);
    try {
      const ok = await onSubmit({ values, photo, removePhoto, again });
      if (ok && again) {
        setValues(emptyFormValues);
        setPhoto(null);
        setRemovePhoto(false);
        if (fileRef.current) fileRef.current.value = '';
        nameRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => submit(false, e)} noValidate className="form">
      {message && <p role="status" className="form-message">{message}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}

      <div className="field">
        <label htmlFor="pf-name">{fa.form.name}</label>
        <input
          id="pf-name"
          ref={nameRef}
          value={values.name}
          onChange={(e) => set('name')(e.target.value)}
          aria-describedby="pf-name-hint"
          aria-invalid={nameError}
          maxLength={100}
          autoComplete="off"
          autoFocus
        />
        <small id="pf-name-hint" className={nameError ? 'field-error' : undefined}>
          {nameError ? fa.form.nameRequired : fa.form.nameHint}
        </small>
      </div>

      <details className="form-more">
        <summary>{fa.form.more}</summary>

        <div className="field">
          <label htmlFor="pf-species">{fa.form.species}</label>
          <input id="pf-species" value={values.species} onChange={(e) => set('species')(e.target.value)} maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="pf-room">{fa.form.room}</label>
          <input id="pf-room" value={values.room} onChange={(e) => set('room')(e.target.value)} maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="pf-light">{fa.form.light}</label>
          <select id="pf-light" value={values.light} onChange={(e) => set('light')(e.target.value as Light)}>
            {LIGHT_VALUES.map((v) => (
              <option key={v} value={v}>{fa.options.light[v]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pf-pot">{fa.form.potMaterial}</label>
          <select id="pf-pot" value={values.potMaterial} onChange={(e) => set('potMaterial')(e.target.value as PotMaterial)}>
            {POT_MATERIAL_VALUES.map((v) => (
              <option key={v} value={v}>{fa.options.potMaterial[v]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pf-size">{fa.form.potSizeCm}</label>
          <input
            id="pf-size"
            type="number"
            inputMode="decimal"
            min={1}
            max={200}
            step="any"
            value={values.potSizeCm}
            onChange={(e) => set('potSizeCm')(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pf-soil">{fa.form.soil}</label>
          <select id="pf-soil" value={values.soil} onChange={(e) => set('soil')(e.target.value as Soil)}>
            {SOIL_VALUES.map((v) => (
              <option key={v} value={v}>{fa.options.soil[v]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pf-notes">{fa.form.notes}</label>
          <textarea id="pf-notes" rows={3} value={values.notes} onChange={(e) => set('notes')(e.target.value)} maxLength={5000} />
        </div>
        <div className="field">
          <label htmlFor="pf-photo">{fa.form.photo}</label>
          <input
            id="pf-photo"
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              setPhoto(e.target.files?.[0] ?? null);
              setRemovePhoto(false);
            }}
          />
          {hasExistingPhoto && !photo && (
            <label className="check">
              <input type="checkbox" checked={removePhoto} onChange={(e) => setRemovePhoto(e.target.checked)} />
              {fa.form.photoRemove}
            </label>
          )}
        </div>
      </details>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{fa.form.save}</button>
        {allowAddAnother && (
          <button type="button" className="btn" disabled={busy} onClick={() => submit(true)}>
            {fa.form.saveAndAnother}
          </button>
        )}
        <button type="button" className="btn btn-quiet" onClick={onCancel}>{fa.form.cancel}</button>
      </div>
    </form>
  );
}
