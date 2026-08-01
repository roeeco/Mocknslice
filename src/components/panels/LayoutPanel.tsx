import type { ChangeEvent } from 'react';
import { copy } from '../../locales/en';
import { useProjectStore } from '../../state/useProjectStore';

export function LayoutPanel() {
  const project = useProjectStore((state) => state.project);
  const activeSheetId = useProjectStore((state) => state.activeSheetId);
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const setActiveSheet = useProjectStore((state) => state.setActiveSheet);
  const arrangeGeneratedParts = useProjectStore((state) => state.arrangeGeneratedParts);
  const updateSheetSettings = useProjectStore((state) => state.updateSheetSettings);
  const addSheet = useProjectStore((state) => state.addSheet);
  const duplicateSheet = useProjectStore((state) => state.duplicateSheet);
  const removeSheet = useProjectStore((state) => state.removeSheet);
  const updatePartPlacement = useProjectStore((state) => state.updatePartPlacement);
  const rotatePartPlacement = useProjectStore((state) => state.rotatePartPlacement);
  const movePartToSheet = useProjectStore((state) => state.movePartToSheet);
  const sheet =
    project.sheetLayouts.find((candidate) => candidate.id === activeSheetId) ??
    project.sheetLayouts[0];
  if (!sheet) return null;

  const placement = sheet.placements.find((candidate) => candidate.partId === selectedEntityId);
  const selectedPart = project.generatedParts.find((part) => part.id === selectedEntityId);
  const placedCount = new Set(
    project.sheetLayouts.flatMap((layout) => layout.placements.map((p) => p.partId)),
  ).size;

  const updatePositive =
    (name: 'widthMm' | 'heightMm') => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.valueAsNumber;
      if (Number.isFinite(value) && value > 0) updateSheetSettings(sheet.id, { [name]: value });
    };
  const updateNonNegative =
    (name: 'marginMm' | 'spacingMm') => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.valueAsNumber;
      if (Number.isFinite(value) && value >= 0) updateSheetSettings(sheet.id, { [name]: value });
    };
  const updatePlacementNumber =
    (name: 'x' | 'y' | 'rotationDeg') => (event: ChangeEvent<HTMLInputElement>) => {
      if (!placement) return;
      const value = event.target.valueAsNumber;
      if (!Number.isFinite(value)) return;
      updatePartPlacement(sheet.id, placement.partId, {
        x: name === 'x' ? value : placement.x,
        y: name === 'y' ? value : placement.y,
        rotationDeg: name === 'rotationDeg' ? value : placement.rotationDeg,
      });
    };

  return (
    <section className="panel-section layout-panel" aria-labelledby="layout-heading">
      <div className="panel-heading-row">
        <p className="eyebrow">Layout</p>
        <span className="phase-badge">Phase 4</span>
      </div>
      <h2 id="layout-heading">{copy.sheetLayout}</h2>
      <p className="layout-summary">
        {placedCount} of {project.generatedParts.length} parts placed ·{' '}
        {project.sheetLayouts.length} {project.sheetLayouts.length === 1 ? 'sheet' : 'sheets'}
      </p>

      <div className="field-stack">
        <label htmlFor="active-sheet">Active sheet</label>
        <select
          id="active-sheet"
          value={sheet.id}
          onChange={(event) => setActiveSheet(event.target.value)}
        >
          {project.sheetLayouts.map((candidate, index) => (
            <option key={candidate.id} value={candidate.id}>
              Sheet {index + 1} · {candidate.placements.length} parts
            </option>
          ))}
        </select>
      </div>

      <div className="sheet-number-grid">
        <div className="field-stack">
          <label htmlFor="sheet-width">{copy.sheetWidth}</label>
          <div className="unit-input">
            <input
              id="sheet-width"
              type="number"
              min="1"
              step="1"
              value={sheet.widthMm}
              onChange={updatePositive('widthMm')}
            />
            <span>mm</span>
          </div>
        </div>
        <div className="field-stack">
          <label htmlFor="sheet-height">{copy.sheetHeight}</label>
          <div className="unit-input">
            <input
              id="sheet-height"
              type="number"
              min="1"
              step="1"
              value={sheet.heightMm}
              onChange={updatePositive('heightMm')}
            />
            <span>mm</span>
          </div>
        </div>
        <div className="field-stack">
          <label htmlFor="sheet-margin">{copy.sheetMargin}</label>
          <div className="unit-input">
            <input
              id="sheet-margin"
              type="number"
              min="0"
              step="0.5"
              value={sheet.marginMm}
              onChange={updateNonNegative('marginMm')}
            />
            <span>mm</span>
          </div>
        </div>
        <div className="field-stack">
          <label htmlFor="part-spacing">{copy.partSpacing}</label>
          <div className="unit-input">
            <input
              id="part-spacing"
              type="number"
              min="0"
              step="0.5"
              value={sheet.spacingMm}
              onChange={updateNonNegative('spacingMm')}
            />
            <span>mm</span>
          </div>
        </div>
      </div>

      <div className="layout-actions">
        <button
          type="button"
          onClick={arrangeGeneratedParts}
          disabled={project.generatedParts.length === 0}
        >
          {copy.arrangeAll}
        </button>
        <button type="button" onClick={addSheet}>
          {copy.addSheet}
        </button>
        <button type="button" onClick={() => duplicateSheet(sheet.id)}>
          {copy.duplicateSheet}
        </button>
        <button
          type="button"
          disabled={project.sheetLayouts.length === 1}
          onClick={() => {
            if (window.confirm('Delete this sheet? Its parts will become unplaced.'))
              removeSheet(sheet.id);
          }}
        >
          {copy.deleteSheet}
        </button>
      </div>

      {selectedPart ? (
        <div className="placement-controls">
          <div className="panel-heading-row">
            <strong>{selectedPart.label ?? selectedPart.name}</strong>
            {placement ? <span>{placement.rotationDeg}°</span> : <span>Unplaced</span>}
          </div>
          {placement ? (
            <>
              <div className="sheet-number-grid">
                <div className="field-stack">
                  <label htmlFor="placement-x">{copy.placementX}</label>
                  <div className="unit-input">
                    <input
                      id="placement-x"
                      type="number"
                      step="0.5"
                      value={placement.x}
                      onChange={updatePlacementNumber('x')}
                    />
                    <span>mm</span>
                  </div>
                </div>
                <div className="field-stack">
                  <label htmlFor="placement-y">{copy.placementY}</label>
                  <div className="unit-input">
                    <input
                      id="placement-y"
                      type="number"
                      step="0.5"
                      value={placement.y}
                      onChange={updatePlacementNumber('y')}
                    />
                    <span>mm</span>
                  </div>
                </div>
              </div>
              <div className="field-stack">
                <label htmlFor="placement-rotation">{copy.placementRotation}</label>
                <div className="rotation-row">
                  <input
                    id="placement-rotation"
                    type="number"
                    step="1"
                    value={placement.rotationDeg}
                    onChange={updatePlacementNumber('rotationDeg')}
                  />
                  <button
                    type="button"
                    onClick={() => rotatePartPlacement(sheet.id, placement.partId)}
                  >
                    {copy.rotate90}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <button
              className="move-to-sheet"
              type="button"
              onClick={() => movePartToSheet(selectedPart.id, sheet.id)}
            >
              Move selected part to this sheet
            </button>
          )}
        </div>
      ) : (
        <p className="field-help">Select a part in either viewport to edit its placement.</p>
      )}
    </section>
  );
}
