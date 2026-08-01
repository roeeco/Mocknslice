import type { ChangeEvent } from 'react';
import type { PanelJointKind } from '../../domain/panelConstruction';
import { useProjectStore } from '../../state/useProjectStore';
import { copy } from '../../locales/en';

function numberHandler(
  setModeParameter: (name: string, value: number | string | boolean) => void,
  name: string,
  minimum: number,
) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.valueAsNumber;
    if (Number.isFinite(value) && value >= minimum) setModeParameter(name, value);
  };
}

export function PanelConstructionPanel() {
  const project = useProjectStore((state) => state.project);
  const status = useProjectStore((state) => state.sliceGenerationStatus);
  const error = useProjectStore((state) => state.sliceGenerationError);
  const setModeParameter = useProjectStore((state) => state.setModeParameter);
  const generate = useProjectStore((state) => state.generatePanelConstruction);
  const cancel = useProjectStore((state) => state.cancelSliceGeneration);
  if (project.fabricationMode !== 'panel-construction') return null;

  const parameters = project.modeParameters;
  const jointKind: PanelJointKind =
    parameters.panelJointKind === 'butt' || parameters.panelJointKind === 'tab-slot'
      ? parameters.panelJointKind
      : 'finger';
  const result = project.panelConstructionResult;
  const slotCount =
    result?.parts.flatMap((part) => part.paths).filter((path) => path.contourRole === 'hole')
      .length ?? 0;

  return (
    <section
      className="panel-section slice-panel panel-construction-panel"
      aria-labelledby="panel-construction-heading"
    >
      <div className="panel-heading-row">
        <p className="eyebrow">Phase 9 · advanced</p>
        <span className={`generation-status status-${status}`}>{status}</span>
      </div>
      <h2 id="panel-construction-heading">{copy.panelConstruction.heading}</h2>
      <p className="field-help fold-intro">{copy.panelConstruction.intro}</p>
      <fieldset disabled={status === 'processing'}>
        <div className="slice-number-grid">
          <div className="field-stack">
            <label htmlFor="panel-inner-width">{copy.panelConstruction.insideWidth}</label>
            <input
              id="panel-inner-width"
              type="number"
              min={1}
              step={1}
              value={Number(parameters.panelInnerWidthMm ?? 80)}
              onChange={numberHandler(setModeParameter, 'panelInnerWidthMm', 1)}
            />
          </div>
          <div className="field-stack">
            <label htmlFor="panel-inner-depth">{copy.panelConstruction.insideDepth}</label>
            <input
              id="panel-inner-depth"
              type="number"
              min={1}
              step={1}
              value={Number(parameters.panelInnerDepthMm ?? 60)}
              onChange={numberHandler(setModeParameter, 'panelInnerDepthMm', 1)}
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
            value={Number(parameters.panelInnerHeightMm ?? 50)}
            onChange={numberHandler(setModeParameter, 'panelInnerHeightMm', 1)}
          />
        </div>
        <div className="field-stack">
          <label htmlFor="panel-joint-kind">{copy.panelConstruction.edgeJoint}</label>
          <select
            id="panel-joint-kind"
            value={jointKind}
            onChange={(event) => setModeParameter('panelJointKind', event.target.value)}
          >
            <option value="finger">Complementary finger joints</option>
            <option value="tab-slot">Tabs and through-slots</option>
            <option value="butt">Straight butt joints</option>
          </select>
          <p className="field-help">
            {jointKind === 'finger'
              ? 'Alternating fingers meet along every enclosure edge.'
              : jointKind === 'tab-slot'
                ? 'One panel receives material-thickness tabs; its mate receives closed slot cuts.'
                : 'Straight panels rely on adhesive, tape, or separate fasteners.'}
          </p>
        </div>
        {jointKind !== 'butt' ? (
          <div className="slice-number-grid">
            <div className="field-stack">
              <label htmlFor="panel-finger-width">{copy.panelConstruction.fingerWidth}</label>
              <input
                id="panel-finger-width"
                type="number"
                min={0.5}
                step={0.5}
                value={Number(parameters.panelFingerWidthMm ?? 10)}
                onChange={numberHandler(setModeParameter, 'panelFingerWidthMm', 0.5)}
              />
            </div>
            <div className="field-stack">
              <label htmlFor="panel-clearance">{copy.panelConstruction.slotClearance}</label>
              <input
                id="panel-clearance"
                type="number"
                min={0}
                step={0.05}
                disabled={jointKind !== 'tab-slot'}
                value={Number(
                  parameters.panelClearanceMm ?? project.materialProfileSnapshot.clearanceMm,
                )}
                onChange={numberHandler(setModeParameter, 'panelClearanceMm', 0)}
              />
            </div>
          </div>
        ) : null}
        <label className="checkbox-field panel-lid-option">
          <input
            type="checkbox"
            checked={Boolean(parameters.panelIncludeLid)}
            onChange={(event) => setModeParameter('panelIncludeLid', event.target.checked)}
          />
          <span>{copy.panelConstruction.includeLid}</span>
        </label>
      </fieldset>
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
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {result?.parts.length ? (
        <div className="unfold-summary" data-testid="panel-construction-summary">
          <span>{result.panels.length} panels</span>
          <span>{result.joints.length} joints</span>
          <span>{slotCount} slots</span>
        </div>
      ) : null}
    </section>
  );
}
