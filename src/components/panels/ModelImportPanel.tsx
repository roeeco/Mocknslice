import { useEffect, useRef, type ChangeEvent } from 'react';
import type { StlUnit } from '../../domain/model';
import type { GeometryTask } from '../../workers/geometryWorkerClient';
import { normalizeStlInWorker } from '../../workers/geometryWorkerClient';
import type { NormalizedMeshResult } from '../../geometry/mesh/normalizeMesh';
import { copy, t } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';

const units: { value: StlUnit; label: string }[] = [
  { value: 'millimetres', label: 'Millimetres (mm)' },
  { value: 'centimetres', label: 'Centimetres (cm)' },
  { value: 'metres', label: 'Metres (m)' },
  { value: 'inches', label: 'Inches (in)' },
];

export function ModelImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const taskRef = useRef<GeometryTask<NormalizedMeshResult> | undefined>(undefined);
  const cancelledRef = useRef(false);
  const assumedStlUnit = useProjectStore((state) => state.assumedStlUnit);
  const status = useProjectStore((state) => state.modelImportStatus);
  const error = useProjectStore((state) => state.modelImportError);
  const setAssumedStlUnit = useProjectStore((state) => state.setAssumedStlUnit);
  const startModelImport = useProjectStore((state) => state.startModelImport);
  const completeModelImport = useProjectStore((state) => state.completeModelImport);
  const failModelImport = useProjectStore((state) => state.failModelImport);
  const cancelModelImport = useProjectStore((state) => state.cancelModelImport);

  useEffect(
    () => () => {
      taskRef.current?.cancel();
    },
    [],
  );

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.stl')) {
      failModelImport('Choose an STL file with the .stl extension.');
      return;
    }

    startModelImport();
    cancelledRef.current = false;
    try {
      const arrayBuffer = await file.arrayBuffer();
      if (cancelledRef.current) return;
      const task = normalizeStlInWorker(arrayBuffer, assumedStlUnit);
      taskRef.current = task;
      const result = await task.promise;
      taskRef.current = undefined;
      completeModelImport(file.name, result);
    } catch (caught) {
      taskRef.current = undefined;
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      failModelImport(
        caught instanceof Error ? caught.message : 'The STL file could not be imported.',
      );
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    taskRef.current?.cancel();
    taskRef.current = undefined;
    cancelModelImport();
  };

  return (
    <section className="panel-section" aria-labelledby="model-import-heading">
      <p className="eyebrow">{t('Import or create')}</p>
      <h2 id="model-import-heading">{copy.importStl}</h2>
      <div className="field-stack">
        <label htmlFor="stl-units">{copy.stlUnits}</label>
        <select
          id="stl-units"
          value={assumedStlUnit}
          onChange={(event) => setAssumedStlUnit(event.target.value as StlUnit)}
          disabled={status === 'processing'}
        >
          {units.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
        <p className="field-help">
          STL files do not store reliable units. SliceFold records this choice and converts to mm.
        </p>
      </div>
      <div className="import-actions">
        <button
          type="button"
          className="secondary-action"
          onClick={() => inputRef.current?.click()}
          disabled={status === 'processing'}
        >
          Choose STL file
        </button>
        {status === 'processing' ? (
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".stl,model/stl,application/sla"
        aria-label={t('Choose STL model')}
        onChange={(event) => void handleFile(event)}
      />
      <div className={`import-status import-status-${status}`} aria-live="polite">
        {status === 'processing' ? (
          <>
            <i aria-hidden="true" /> Reading and inspecting geometry…
          </>
        ) : null}
        {status === 'ready' ? 'STL imported and inspected.' : null}
        {status === 'cancelled' ? 'Import cancelled.' : null}
        {status === 'error' && error ? <span role="alert">{error}</span> : null}
      </div>
    </section>
  );
}
