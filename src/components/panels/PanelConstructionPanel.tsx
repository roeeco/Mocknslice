import type { ChangeEvent } from 'react';
import type { CurrentPanelJointKind } from '../../domain/panelConstruction';
import type { PanelProfileKind } from '../../domain/panelConstruction';
import {
  hasRaisedPanelProfile,
  maximumPanelDividerCount,
  panelCellMeasurements,
} from '../../domain/panelConstruction';
import { useProjectStore } from '../../state/useProjectStore';
import { copy, t } from '../../locales';
import { AdvancedSettingsSection } from './AdvancedSettingsSection';
import { RuntimeFailureMessage } from '../RuntimeFailureMessage';
import type { PanelComposerSettings } from '../../domain/modeSettings';
import { ClassroomRecipeSelect } from './ClassroomRecipePanel';
import { ConnectionInspector } from './ConnectionInspector';

function numberHandler(
  updateSettings: (patch: Partial<PanelComposerSettings>) => void,
  name: keyof Pick<
    PanelComposerSettings,
    'innerWidthMm' | 'innerDepthMm' | 'innerHeightMm' | 'fingerWidthMm' | 'clearanceMm'
  >,
  minimum: number,
) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.valueAsNumber;
    if (Number.isFinite(value) && value >= minimum) updateSettings({ [name]: value });
  };
}

export function PanelConstructionPanel({
  hideGenerationAction = false,
}: { hideGenerationAction?: boolean } = {}) {
  const project = useProjectStore((state) => state.project);
  const experienceMode = useProjectStore((state) => state.experienceMode);
  const status = useProjectStore((state) => state.sliceGenerationStatus);
  const error = useProjectStore((state) => state.sliceGenerationError);
  const updateSettings = useProjectStore((state) => state.updatePanelComposerSettings);
  const generate = useProjectStore((state) => state.generatePanelConstruction);
  const cancel = useProjectStore((state) => state.cancelSliceGeneration);
  if (project.fabricationMode !== 'panel-construction') return null;

  const settings = project.modeSettings.panelConstruction;
  const jointKind: CurrentPanelJointKind = settings.jointKind;
  const widthDividerCount = settings.widthDividerCount;
  const depthDividerCount = settings.depthDividerCount;
  const dividerCount = widthDividerCount + depthDividerCount;
  const maximumWidthDividers = maximumPanelDividerCount(
    settings.innerDepthMm,
    settings.dividerThicknessMm,
  );
  const maximumDepthDividers = maximumPanelDividerCount(
    settings.innerWidthMm,
    settings.dividerThicknessMm,
  );
  const cells = panelCellMeasurements(settings);
  const result = project.panelConstructionResult;
  const slotCount =
    result?.parts.flatMap((part) => part.paths).filter((path) => path.contourRole === 'hole')
      .length ?? 0;
  const updateProfile = (role: 'front' | 'back', profile: PanelProfileKind) =>
    updateSettings({ panelProfiles: { ...settings.panelProfiles, [role]: profile } });

  return (
    <section
      className="panel-section slice-panel panel-construction-panel"
      aria-labelledby="panel-construction-heading"
    >
      <div className="panel-heading-row">
        <p className="eyebrow">{t('Fabrication')}</p>
        <span className={`generation-status status-${status}`}>
          {copy.generationStatus[status]}
        </span>
      </div>
      <h2 id="panel-construction-heading">{copy.panelConstruction.heading}</h2>
      <p className="field-help fold-intro">{copy.panelConstruction.intro}</p>
      <fieldset disabled={status === 'processing'}>
        <ClassroomRecipeSelect />
        <div className="slice-number-grid">
          <div className="field-stack">
            <label htmlFor="panel-inner-width">{copy.panelConstruction.insideWidth}</label>
            <input
              id="panel-inner-width"
              type="number"
              min={1}
              step={1}
              value={settings.innerWidthMm}
              onChange={numberHandler(updateSettings, 'innerWidthMm', 1)}
            />
          </div>
          <div className="field-stack">
            <label htmlFor="panel-inner-depth">{copy.panelConstruction.insideDepth}</label>
            <input
              id="panel-inner-depth"
              type="number"
              min={1}
              step={1}
              value={settings.innerDepthMm}
              onChange={numberHandler(updateSettings, 'innerDepthMm', 1)}
            />
          </div>
        </div>
        <div className="field-stack">
          <label htmlFor="panel-inner-height">{copy.panelConstruction.insideHeight}</label>
          <input
            id="panel-inner-height"
            type="number"
            min={1}
            step={1}
            value={settings.innerHeightMm}
            onChange={numberHandler(updateSettings, 'innerHeightMm', 1)}
          />
        </div>
        <div className="field-stack">
          <label htmlFor="panel-joint-kind">{copy.panelConstruction.edgeJoint}</label>
          <select
            id="panel-joint-kind"
            value={jointKind}
            onChange={(event) =>
              updateSettings({ jointKind: event.target.value as CurrentPanelJointKind })
            }
          >
            <option value="finger">{t('Complementary finger joints')}</option>
            <option value="butt">{t('Straight butt joints')}</option>
          </select>
          <p className="field-help">
            {jointKind === 'finger'
              ? t('Alternating fingers meet along every enclosure edge.')
              : t('Straight panels rely on adhesive, tape, or separate fasteners.')}
          </p>
        </div>
        <div className="panel-thickness-controls">
          <div className="field-stack range-field">
            <div className="range-field-heading">
              <label htmlFor="panel-stock-thickness">{copy.panelConstruction.panelThickness}</label>
              <output>{settings.panelThicknessMm} mm</output>
            </div>
            <input
              id="panel-stock-thickness"
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={settings.panelThicknessMm}
              onChange={(event) => updateSettings({ panelThicknessMm: event.target.valueAsNumber })}
            />
          </div>
          <div className="field-stack range-field">
            <div className="range-field-heading">
              <label htmlFor="panel-divider-thickness">
                {copy.panelConstruction.dividerThickness}
              </label>
              <output>{settings.dividerThicknessMm} mm</output>
            </div>
            <input
              id="panel-divider-thickness"
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={settings.dividerThicknessMm}
              onChange={(event) =>
                updateSettings({ dividerThicknessMm: event.target.valueAsNumber })
              }
            />
          </div>
          {settings.includeLid ? (
            <div className="field-stack range-field">
              <div className="range-field-heading">
                <label htmlFor="panel-lid-thickness">{copy.panelConstruction.lidThickness}</label>
                <output>{settings.lidThicknessMm} mm</output>
              </div>
              <input
                id="panel-lid-thickness"
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={settings.lidThicknessMm}
                onChange={(event) => updateSettings({ lidThicknessMm: event.target.valueAsNumber })}
              />
            </div>
          ) : null}
        </div>
        <label className="checkbox-field panel-lid-option">
          <input
            type="checkbox"
            checked={settings.includeLid}
            onChange={(event) => updateSettings({ includeLid: event.target.checked })}
          />
          <span>{copy.panelConstruction.includeLid}</span>
        </label>
        <div className="panel-profile-controls">
          <h3>{copy.panelConstruction.panelProfiles}</h3>
          <p className="field-help">{copy.panelConstruction.panelProfilesHelp}</p>
          <div className="slice-number-grid">
            {(['front', 'back'] as const).map((role) => (
              <div className="field-stack" key={role}>
                <label htmlFor={`panel-${role}-profile`}>
                  {role === 'front'
                    ? copy.panelConstruction.frontProfile
                    : copy.panelConstruction.backProfile}
                </label>
                <select
                  id={`panel-${role}-profile`}
                  value={settings.panelProfiles[role]}
                  onChange={(event) => updateProfile(role, event.target.value as PanelProfileKind)}
                >
                  <option value="flat">{copy.panelConstruction.profileKinds.flat}</option>
                  <option value="arch">{copy.panelConstruction.profileKinds.arch}</option>
                  <option value="gable">{copy.panelConstruction.profileKinds.gable}</option>
                  <option value="stepped">{copy.panelConstruction.profileKinds.stepped}</option>
                </select>
              </div>
            ))}
          </div>
          {settings.includeLid && hasRaisedPanelProfile(settings.panelProfiles) ? (
            <p className="inline-error" role="alert">
              {copy.panelConstruction.profileLidConflict}
            </p>
          ) : null}
        </div>
        <div className="slice-number-grid">
          <div className="field-stack">
            <label htmlFor="panel-width-divider-count">
              {copy.panelConstruction.widthDividerCount}
            </label>
            <input
              id="panel-width-divider-count"
              type="range"
              min={0}
              max={maximumWidthDividers}
              step={1}
              value={widthDividerCount}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                if (Number.isFinite(value))
                  updateSettings({
                    widthDividerCount: Math.max(
                      0,
                      Math.min(maximumWidthDividers, Math.round(value)),
                    ),
                  });
              }}
            />
            <output>
              {widthDividerCount} / {maximumWidthDividers}
            </output>
          </div>
          <div className="field-stack">
            <label htmlFor="panel-depth-divider-count">
              {copy.panelConstruction.depthDividerCount}
            </label>
            <input
              id="panel-depth-divider-count"
              type="range"
              min={0}
              max={maximumDepthDividers}
              step={1}
              value={depthDividerCount}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                if (Number.isFinite(value))
                  updateSettings({
                    depthDividerCount: Math.max(
                      0,
                      Math.min(maximumDepthDividers, Math.round(value)),
                    ),
                  });
              }}
            />
            <output>
              {depthDividerCount} / {maximumDepthDividers}
            </output>
          </div>
        </div>
        <div className="panel-cell-measurements" aria-live="polite">
          <strong>{copy.panelConstruction.cellSpace}</strong>
          <span>
            {cells.count} {copy.panelConstruction.cells} · {cells.widthMm.toFixed(1)} ×{' '}
            {cells.depthMm.toFixed(1)} × {cells.heightMm.toFixed(1)} mm
          </span>
          <small>{copy.panelConstruction.cellSpaceOrder}</small>
        </div>
        {dividerCount > 0 ? (
          <p className="field-help">{copy.panelConstruction.dividerHelp}</p>
        ) : null}
        {experienceMode === 'advanced' && (jointKind !== 'butt' || dividerCount > 0) ? (
          <AdvancedSettingsSection>
            <div className="slice-number-grid">
              <div className="field-stack">
                <label htmlFor="panel-finger-width">{copy.panelConstruction.fingerWidth}</label>
                <input
                  id="panel-finger-width"
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={settings.fingerWidthMm}
                  onChange={numberHandler(updateSettings, 'fingerWidthMm', 0.5)}
                />
              </div>
              <div className="field-stack">
                <label htmlFor="panel-clearance">{copy.panelConstruction.slotClearance}</label>
                <input
                  id="panel-clearance"
                  type="number"
                  min={0}
                  step={0.05}
                  disabled={dividerCount === 0}
                  value={settings.clearanceMm}
                  onChange={numberHandler(updateSettings, 'clearanceMm', 0)}
                />
              </div>
            </div>
          </AdvancedSettingsSection>
        ) : null}
      </fieldset>
      <ConnectionInspector mode="panel-construction" />
      {!hideGenerationAction ? (
        <div className="generation-actions">
          {status === 'processing' ? (
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          ) : (
            <button className="primary-panel-action" type="button" onClick={generate}>
              {status === 'stale'
                ? copy.panelConstruction.regenerate
                : copy.panelConstruction.generate}
            </button>
          )}
          <span aria-live="polite">
            {status === 'processing'
              ? 'Building joints…'
              : result
                ? `${result.panels.length} panels · ${result.joints.length} joints`
                : 'Ready to build'}
          </span>
        </div>
      ) : null}
      {error ? (
        <p className="inline-error" role="alert">
          <RuntimeFailureMessage failure={error} />
        </p>
      ) : null}
      {!hideGenerationAction && result?.parts.length ? (
        <div className="unfold-summary" data-testid="panel-construction-summary">
          <span>{result.panels.length} panels</span>
          <span>{result.joints.length} joints</span>
          <span>{slotCount} slots</span>
        </div>
      ) : null}
    </section>
  );
}
