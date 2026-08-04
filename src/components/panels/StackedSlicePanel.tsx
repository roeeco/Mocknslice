import type { ChangeEvent } from 'react';
import type { SliceAxis } from '../../domain/fabrication';
import { copy, t } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';
import { AdvancedSettingsSection } from './AdvancedSettingsSection';
import { RuntimeFailureMessage } from '../RuntimeFailureMessage';

const axes: SliceAxis[] = ['x', 'y', 'z'];

export function StackedSlicePanel({
  hideGenerationAction = false,
}: { hideGenerationAction?: boolean } = {}) {
  const project = useProjectStore((state) => state.project);
  const experienceMode = useProjectStore((state) => state.experienceMode);
  const status = useProjectStore((state) => state.sliceGenerationStatus);
  const error = useProjectStore((state) => state.sliceGenerationError);
  const setModeParameter = useProjectStore((state) => state.setModeParameter);
  const generateSlices = useProjectStore((state) => state.generateSlices);
  const cancelSliceGeneration = useProjectStore((state) => state.cancelSliceGeneration);
  const axis = (project.modeParameters.sliceAxis as SliceAxis | undefined) ?? 'z';
  const spacing = Number(project.modeParameters.spacingMm ?? 10);
  const thickness = Number(
    project.modeParameters.sliceThicknessMm ?? project.materialProfileSnapshot.thicknessMm,
  );
  const disabled = project.fabricationMode !== 'stacked-slices';
  if (disabled) return null;

  const updateNumber = (name: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.valueAsNumber;
    if (Number.isFinite(value) && value > 0) setModeParameter(name, value);
  };

  return (
    <section className="panel-section slice-panel" aria-labelledby="slice-heading">
      <div className="panel-heading-row">
        <p className="eyebrow">{t('Fabrication')}</p>
        <span className={`generation-status status-${status}`}>
          {copy.generationStatus[status]}
        </span>
      </div>
      <h2 id="slice-heading">{copy.stackedSlices}</h2>
      <fieldset disabled={disabled || status === 'processing'}>
        <div className="field-stack">
          <label htmlFor="slice-axis">{copy.sliceAxis}</label>
          <select
            id="slice-axis"
            value={axis}
            onChange={(event) => setModeParameter('sliceAxis', event.target.value)}
          >
            {axes.map((candidate) => (
              <option value={candidate} key={candidate}>
                {candidate.toUpperCase()} axis
              </option>
            ))}
          </select>
        </div>
        <div className="field-stack">
          <div className="field-stack">
            <label htmlFor="slice-spacing">{copy.sliceSpacing}</label>
            <div className="unit-input">
              <input
                id="slice-spacing"
                type="number"
                min="0.1"
                step="0.5"
                value={spacing}
                onChange={updateNumber('spacingMm')}
              />
              <span>mm</span>
            </div>
          </div>
        </div>
        {experienceMode === 'advanced' ? (
          <AdvancedSettingsSection>
            <div className="slice-number-grid">
              <div className="field-stack">
                <label htmlFor="slice-thickness">{copy.partThickness}</label>
                <div className="unit-input">
                  <input
                    id="slice-thickness"
                    type="number"
                    min="0.05"
                    step="0.1"
                    value={thickness}
                    onChange={updateNumber('sliceThicknessMm')}
                  />
                  <span>mm</span>
                </div>
              </div>
              <div className="field-stack">
                <label htmlFor="slice-contour-tolerance">{t('Contour tolerance')}</label>
                <div className="unit-input">
                  <input
                    id="slice-contour-tolerance"
                    type="number"
                    min="0.0001"
                    step="0.001"
                    value={Number(project.modeParameters.contourEpsilonMm ?? 0.001)}
                    onChange={updateNumber('contourEpsilonMm')}
                  />
                  <span>mm</span>
                </div>
              </div>
            </div>
          </AdvancedSettingsSection>
        ) : null}
      </fieldset>
      {!hideGenerationAction ? (
        <div className="generation-actions">
          {status === 'processing' ? (
            <button type="button" onClick={cancelSliceGeneration}>
              {copy.cancelGeneration}
            </button>
          ) : (
            <button
              className="primary-panel-action"
              type="button"
              onClick={generateSlices}
              disabled={disabled}
            >
              {status === 'stale' ? 'Regenerate slices' : copy.generateSlices}
            </button>
          )}
          <span aria-live="polite">
            {status === 'processing'
              ? 'Tracing contours…'
              : `${project.generatedParts.length} part${project.generatedParts.length === 1 ? '' : 's'}`}
          </span>
        </div>
      ) : null}
      {error ? (
        <p className="inline-error" role="alert">
          <RuntimeFailureMessage failure={error} />
        </p>
      ) : null}
    </section>
  );
}
