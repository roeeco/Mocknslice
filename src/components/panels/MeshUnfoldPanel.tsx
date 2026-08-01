import type { ChangeEvent } from 'react';
import type { MeshUnfoldStrategy } from '../../domain/unfolding';
import { useProjectStore } from '../../state/useProjectStore';
import { t } from '../../locales';

function numericChange(
  setModeParameter: (name: string, value: number | string | boolean) => void,
  name: string,
  minimum: number,
  integer = false,
) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.valueAsNumber;
    if (!Number.isFinite(raw) || raw < minimum) return;
    setModeParameter(name, integer ? Math.round(raw) : raw);
  };
}

export function MeshUnfoldPanel({
  hideGenerationAction = false,
}: { hideGenerationAction?: boolean } = {}) {
  const project = useProjectStore((state) => state.project);
  const status = useProjectStore((state) => state.sliceGenerationStatus);
  const error = useProjectStore((state) => state.sliceGenerationError);
  const progress = useProjectStore((state) => state.foldPreviewProgress);
  const setProgress = useProjectStore((state) => state.setFoldPreviewProgress);
  const setModeParameter = useProjectStore((state) => state.setModeParameter);
  const generate = useProjectStore((state) => state.generateMeshUnfold);
  const cancel = useProjectStore((state) => state.cancelSliceGeneration);
  if (project.fabricationMode !== 'mesh-unfold') return null;

  const parameters = project.modeParameters;
  const strategy: MeshUnfoldStrategy =
    parameters.meshUnfoldStrategy === 'manual' ? 'manual' : 'automatic';
  const seamKeys = new Set(
    String(parameters.meshUnfoldSeams ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean),
  );
  const result = project.unfoldingResult;
  const sharedEdges = result?.edges.filter((edge) => edge.faceBIndex !== undefined) ?? [];
  const toggleSeam = (key: string, checked: boolean) => {
    const next = new Set(seamKeys);
    if (checked) next.add(key);
    else next.delete(key);
    setModeParameter('meshUnfoldSeams', [...next].sort().join(','));
  };

  return (
    <section
      className="panel-section slice-panel mesh-unfold-panel"
      aria-labelledby="unfold-heading"
    >
      <div className="panel-heading-row">
        <p className="eyebrow">Phase 8 · low-poly</p>
        <span className={`generation-status status-${status}`}>{status}</span>
      </div>
      <h2 id="unfold-heading">{t('Mesh unfolding')}</h2>
      <p className="field-help fold-intro">
        Flatten a closed, consistently oriented triangular mesh into editable seam islands. This
        bounded release does not repair meshes or guarantee an overlap-free net.
      </p>
      <fieldset disabled={status === 'processing'}>
        <div className="field-stack">
          <label htmlFor="mesh-unfold-strategy">{t('Seam strategy')}</label>
          <select
            id="mesh-unfold-strategy"
            value={strategy}
            onChange={(event) => setModeParameter('meshUnfoldStrategy', event.target.value)}
          >
            <option value="automatic">{t('Automatic tree search')}</option>
            <option value="manual">{t('Manual seam constraints')}</option>
          </select>
          <p className="field-help">
            Manual seams are forced cuts; extra cuts are added when needed to remove fold cycles.
          </p>
        </div>
        <div className="slice-number-grid">
          <div className="field-stack">
            <label htmlFor="mesh-unfold-root">{t('Root triangle')}</label>
            <input
              id="mesh-unfold-root"
              type="number"
              min={0}
              step={1}
              value={Number(parameters.meshUnfoldRootFace ?? 0)}
              onChange={numericChange(setModeParameter, 'meshUnfoldRootFace', 0, true)}
            />
          </div>
          <div className="field-stack">
            <label htmlFor="mesh-unfold-tab-depth">{t('Tab depth (mm)')}</label>
            <input
              id="mesh-unfold-tab-depth"
              type="number"
              min={0.1}
              step={0.5}
              value={Number(parameters.meshUnfoldTabDepthMm ?? 6)}
              onChange={numericChange(setModeParameter, 'meshUnfoldTabDepthMm', 0.1)}
            />
          </div>
        </div>
        <div className="slice-number-grid">
          <div className="field-stack">
            <label htmlFor="mesh-unfold-face-limit">{t('Face limit')}</label>
            <input
              id="mesh-unfold-face-limit"
              type="number"
              min={1}
              max={1000}
              step={1}
              value={Number(parameters.meshUnfoldMaximumFaces ?? 200)}
              onChange={numericChange(setModeParameter, 'meshUnfoldMaximumFaces', 1, true)}
            />
          </div>
          <div className="field-stack">
            <label htmlFor="mesh-unfold-attempts">{t('Search attempts')}</label>
            <input
              id="mesh-unfold-attempts"
              type="number"
              min={1}
              max={1200}
              step={1}
              disabled={strategy === 'manual'}
              value={Number(parameters.meshUnfoldSearchAttempts ?? 18)}
              onChange={numericChange(setModeParameter, 'meshUnfoldSearchAttempts', 1, true)}
            />
          </div>
        </div>
      </fieldset>
      {!hideGenerationAction ? (
        <div className="generation-actions">
          {status === 'processing' ? (
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          ) : (
            <button className="primary-panel-action" type="button" onClick={generate}>
              {status === 'stale' ? 'Regenerate net' : 'Generate net'}
            </button>
          )}
          <span aria-live="polite">
            {status === 'processing'
              ? 'Searching seam trees…'
              : result
                ? `${result.faces.length} faces · ${result.islands.length} island${result.islands.length === 1 ? '' : 's'}`
                : 'Ready to unfold'}
          </span>
        </div>
      ) : null}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {!hideGenerationAction && result?.parts.length ? (
        <>
          <div className="unfold-summary" data-testid="mesh-unfold-summary">
            <span>{result.edges.filter((edge) => edge.disposition === 'hinge').length} folds</span>
            <span>{result.tabs.length} tabs</span>
            <span className={result.overlapPairs.length ? 'summary-warning' : undefined}>
              {result.overlapPairs.length} overlaps
            </span>
          </div>
          <div className="field-stack unfold-progress">
            <div className="panel-heading-row">
              <label htmlFor="mesh-fold-progress">{t('Folding preview')}</label>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <input
              id="mesh-fold-progress"
              type="range"
              min={0}
              max={100}
              value={Math.round(progress * 100)}
              onChange={(event) => setProgress(event.target.valueAsNumber / 100)}
            />
            <p className="field-help">{t('Flat net → reconstructed fold tree')}</p>
          </div>
          <details className="unfold-seams" open={strategy === 'manual'}>
            <summary>Mesh edges and manual seams ({sharedEdges.length})</summary>
            <div className="unfold-edge-list">
              {sharedEdges.map((edge) => (
                <label key={edge.id} className="checkbox-field unfold-edge-row">
                  <input
                    type="checkbox"
                    disabled={strategy !== 'manual' || status === 'processing'}
                    checked={seamKeys.has(edge.key)}
                    onChange={(event) => toggleSeam(edge.key, event.target.checked)}
                  />
                  <span>
                    {edge.key} · T{edge.faceAIndex + 1}/T{(edge.faceBIndex ?? 0) + 1}
                    <small>{edge.disposition.replace('-', ' ')}</small>
                  </span>
                </label>
              ))}
            </div>
          </details>
        </>
      ) : null}
    </section>
  );
}
