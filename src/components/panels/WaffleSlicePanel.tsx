import type { ChangeEvent } from 'react';
import type { SliceAxis } from '../../domain/fabrication';
import type { WaffleSliceSettings } from '../../domain/slicing';
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
  const updateSettings = useProjectStore((state) => state.updateWaffleSliceSettings);
  const generateWaffleSlices = useProjectStore((state) => state.generateWaffleSlices);
  const cancelSliceGeneration = useProjectStore((state) => state.cancelSliceGeneration);
  if (project.fabricationMode !== 'waffle-slices') return null;

  const settings = project.modeSettings.waffleSlices;
  const jointCount =
    project.generatedParts.reduce((count, part) => count + (part.waffle?.slotCount ?? 0), 0) / 2;

  const updatePositive =
    (
      name: keyof Pick<
        WaffleSliceSettings,
        'primarySpacingMm' | 'secondarySpacingMm' | 'thicknessMm'
      >,
    ) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.valueAsNumber;
      if (Number.isFinite(value) && value > 0) updateSettings({ [name]: value });
    };
  const updateNonNegative =
    (name: keyof Pick<WaffleSliceSettings, 'clearanceMm'>) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.valueAsNumber;
      if (Number.isFinite(value) && value >= 0) updateSettings({ [name]: value });
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
              value={settings.primaryAxis}
              onChange={(event) => updateSettings({ primaryAxis: event.target.value as SliceAxis })}
            >
              {axes
                .filter((axis) => axis !== settings.secondaryAxis)
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
              value={settings.secondaryAxis}
              onChange={(event) =>
                updateSettings({ secondaryAxis: event.target.value as SliceAxis })
              }
            >
              {axes
                .filter((axis) => axis !== settings.primaryAxis)
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
                value={settings.primarySpacingMm}
                onChange={updatePositive('primarySpacingMm')}
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
                value={settings.secondarySpacingMm}
                onChange={updatePositive('secondarySpacingMm')}
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
                    value={settings.thicknessMm}
                    onChange={updatePositive('thicknessMm')}
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
                    value={settings.clearanceMm}
                    onChange={updateNonNegative('clearanceMm')}
                  />
                  <span>mm</span>
                </div>
              </div>
            </div>
            <p className="slot-width-readout">
              {t('Slot width')}{' '}
              <strong>
                {Math.round((settings.thicknessMm + settings.clearanceMm) * 1000) / 1000} mm
              </strong>
            </p>
            <div className="field-stack">
              <label htmlFor="waffle-slot-pattern">{copy.slotPattern}</label>
              <select
                id="waffle-slot-pattern"
                value={settings.slotPattern}
                onChange={(event) =>
                  updateSettings({
                    slotPattern: event.target.value as WaffleSliceSettings['slotPattern'],
                  })
                }
              >
                <option value="alternating">{t('Alternate top and bottom')}</option>
                <option value="by-family">{t('Family A from one side')}</option>
              </select>
            </div>
            <label className="checkbox-field" htmlFor="waffle-reverse-slots">
              <input
                id="waffle-reverse-slots"
                type="checkbox"
                checked={settings.reverseSlots}
                onChange={(event) => updateSettings({ reverseSlots: event.target.checked })}
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
