import type { ChangeEvent } from 'react';
import type { SliceAxis } from '../../domain/fabrication';
import type { WaffleSlotPattern } from '../../geometry/slicing/types';
import { copy, t } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';
import { AdvancedSettingsSection } from './AdvancedSettingsSection';
import { RuntimeFailureMessage } from '../RuntimeFailureMessage';

const axes: SliceAxis[] = ['x', 'y', 'z'];

export function WaffleSlicePanel({
  hideGenerationAction = false,
}: { hideGenerationAction?: boolean } = {}) {
  const project = useProjectStore((state) => state.project);
  const experienceMode = useProjectStore((state) => state.experienceMode);
  const status = useProjectStore((state) => state.sliceGenerationStatus);
  const error = useProjectStore((state) => state.sliceGenerationError);
  const setModeParameter = useProjectStore((state) => state.setModeParameter);
  const generateWaffleSlices = useProjectStore((state) => state.generateWaffleSlices);
  const cancelSliceGeneration = useProjectStore((state) => state.cancelSliceGeneration);
  if (project.fabricationMode !== 'waffle-slices') return null;

  const primaryAxis = (project.modeParameters.wafflePrimaryAxis as SliceAxis | undefined) ?? 'x';
  const secondaryAxis =
    (project.modeParameters.waffleSecondaryAxis as SliceAxis | undefined) ?? 'y';
  const primarySpacing = Number(project.modeParameters.wafflePrimarySpacingMm ?? 20);
  const secondarySpacing = Number(project.modeParameters.waffleSecondarySpacingMm ?? 20);
  const thickness = Number(
    project.modeParameters.waffleThicknessMm ?? project.materialProfileSnapshot.thicknessMm,
  );
  const clearance = Number(
    project.modeParameters.waffleClearanceMm ?? project.materialProfileSnapshot.clearanceMm,
  );
  const pattern =
    (project.modeParameters.waffleSlotPattern as WaffleSlotPattern | undefined) ?? 'alternating';
  const reverseSlots = Boolean(project.modeParameters.waffleReverseSlots);
  const jointCount =
    project.generatedParts.reduce((count, part) => count + (part.waffle?.slotCount ?? 0), 0) / 2;

  const updatePositive = (name: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.valueAsNumber;
    if (Number.isFinite(value) && value > 0) setModeParameter(name, value);
  };
  const updateNonNegative = (name: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.valueAsNumber;
    if (Number.isFinite(value) && value >= 0) setModeParameter(name, value);
  };

  return (
    <section className="panel-section slice-panel waffle-panel" aria-labelledby="waffle-heading">
      <div className="panel-heading-row">
        <p className="eyebrow">{t('Fabrication')}</p>
        <span className={`generation-status status-${status}`}>
          {copy.generationStatus[status]}
        </span>
      </div>
      <h2 id="waffle-heading">{copy.waffleSlices}</h2>
      <p className="field-help waffle-intro">
        {t('Two perpendicular slice families receive complementary half-depth slots.')}
      </p>
      <fieldset disabled={status === 'processing'}>
        <div className="slice-number-grid">
          <div className="field-stack">
            <label htmlFor="waffle-primary-axis">{copy.primaryAxis}</label>
            <select
              id="waffle-primary-axis"
              value={primaryAxis}
              onChange={(event) => setModeParameter('wafflePrimaryAxis', event.target.value)}
            >
              {axes
                .filter((axis) => axis !== secondaryAxis)
                .map((axis) => (
                  <option value={axis} key={axis}>
                    {axis.toUpperCase()} axis
                  </option>
                ))}
            </select>
          </div>
          <div className="field-stack">
            <label htmlFor="waffle-secondary-axis">{copy.secondaryAxis}</label>
            <select
              id="waffle-secondary-axis"
              value={secondaryAxis}
              onChange={(event) => setModeParameter('waffleSecondaryAxis', event.target.value)}
            >
              {axes
                .filter((axis) => axis !== primaryAxis)
                .map((axis) => (
                  <option value={axis} key={axis}>
                    {axis.toUpperCase()} axis
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="slice-number-grid">
          <div className="field-stack">
            <label htmlFor="waffle-primary-spacing">{copy.primarySpacing}</label>
            <div className="unit-input">
              <input
                id="waffle-primary-spacing"
                type="number"
                min="0.1"
                step="0.5"
                value={primarySpacing}
                onChange={updatePositive('wafflePrimarySpacingMm')}
              />
              <span>mm</span>
            </div>
          </div>
          <div className="field-stack">
            <label htmlFor="waffle-secondary-spacing">{copy.secondarySpacing}</label>
            <div className="unit-input">
              <input
                id="waffle-secondary-spacing"
                type="number"
                min="0.1"
                step="0.5"
                value={secondarySpacing}
                onChange={updatePositive('waffleSecondarySpacingMm')}
              />
              <span>mm</span>
            </div>
          </div>
        </div>
        {experienceMode === 'advanced' ? (
          <AdvancedSettingsSection>
            <div className="slice-number-grid">
              <div className="field-stack">
                <label htmlFor="waffle-thickness">{copy.partThickness}</label>
                <div className="unit-input">
                  <input
                    id="waffle-thickness"
                    type="number"
                    min="0.05"
                    step="0.1"
                    value={thickness}
                    onChange={updatePositive('waffleThicknessMm')}
                  />
                  <span>mm</span>
                </div>
              </div>
              <div className="field-stack">
                <label htmlFor="waffle-clearance">{copy.slotClearance}</label>
                <div className="unit-input">
                  <input
                    id="waffle-clearance"
                    type="number"
                    min="0"
                    step="0.05"
                    value={clearance}
                    onChange={updateNonNegative('waffleClearanceMm')}
                  />
                  <span>mm</span>
                </div>
              </div>
            </div>
            <p className="slot-width-readout">
              {t('Slot width')}{' '}
              <strong>{Math.round((thickness + clearance) * 1000) / 1000} mm</strong>
            </p>
            <div className="field-stack">
              <label htmlFor="waffle-slot-pattern">{copy.slotPattern}</label>
              <select
                id="waffle-slot-pattern"
                value={pattern}
                onChange={(event) => setModeParameter('waffleSlotPattern', event.target.value)}
              >
                <option value="alternating">{t('Alternate top and bottom')}</option>
                <option value="by-family">{t('Family A from one side')}</option>
              </select>
            </div>
            <label className="checkbox-field" htmlFor="waffle-reverse-slots">
              <input
                id="waffle-reverse-slots"
                type="checkbox"
                checked={reverseSlots}
                onChange={(event) => setModeParameter('waffleReverseSlots', event.target.checked)}
              />
              <span>{copy.reverseSlots}</span>
            </label>
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
            <button className="primary-panel-action" type="button" onClick={generateWaffleSlices}>
              {status === 'stale' ? 'Regenerate waffle slices' : copy.generateWaffle}
            </button>
          )}
          <span aria-live="polite">
            {status === 'processing'
              ? 'Cutting slots…'
              : `${project.generatedParts.length} part${project.generatedParts.length === 1 ? '' : 's'}${project.generatedParts.length > 0 ? ` · ${jointCount} joints` : ''}`}
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
