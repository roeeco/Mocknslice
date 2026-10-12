import { useMemo, type ChangeEvent } from 'react';
import type { FoldLineOutput, KerfCompensationMode } from '../../domain/exports';
import type { OperationStyle } from '../../domain/operations';
import { createAssemblyPdfDownload } from '../../exporters/exportPdf';
import { createSheetSvgDownload } from '../../exporters/exportSvg';
import {
  calculateMaterialUsage,
  prepareFabricationOutput,
} from '../../geometry/output/prepareFabricationOutput';
import { deriveTightOutputLayout } from '../../geometry/layout/deriveTightOutputLayout';
import { copy, t } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';
import { deriveGenerationState } from '../../domain/generation';
import { AdvancedSettingsSection } from './AdvancedSettingsSection';

const operationLabels: Record<OperationStyle['operation'], string> = {
  cut: 'Cut',
  score: 'Score',
  'mountain-fold': 'Mountain fold',
  'valley-fold': 'Valley fold',
  perforate: 'Perforate',
  engrave: 'Engrave',
  guide: 'Guide',
};

function areaLabel(areaMm2: number): string {
  return areaMm2 >= 10_000
    ? `${Math.round((areaMm2 / 1_000_000) * 1000) / 1000} m²`
    : `${Math.round(areaMm2)} mm²`;
}

export function FabricationOutputPanel() {
  const project = useProjectStore((state) => state.project);
  const experienceMode = useProjectStore((state) => state.experienceMode);
  const activeSheetId = useProjectStore((state) => state.activeSheetId);
  const updateExportSettings = useProjectStore((state) => state.updateExportSettings);
  const prepared = useMemo(() => prepareFabricationOutput(project), [project]);
  const layouts = useMemo(
    () =>
      experienceMode === 'standard'
        ? [deriveTightOutputLayout(prepared.parts)]
        : project.sheetLayouts,
    [experienceMode, prepared.parts, project.sheetLayouts],
  );
  const usage = useMemo(
    () => calculateMaterialUsage(project, prepared.parts, layouts),
    [layouts, prepared.parts, project],
  );
  const activeSheet = layouts.find((sheet) => sheet.id === activeSheetId) ?? layouts[0];
  const settings = project.exportSettings;
  const hasPlacedParts = usage.usedSheetCount > 0;
  const hasOutputErrors = prepared.issues.some((issue) => issue.severity === 'error');
  const generationState = deriveGenerationState(project);
  const exportBlocked = generationState !== 'ready';

  const updateNumber =
    (
      name: 'customKerfMm' | 'perforationDashMm' | 'perforationGapMm' | 'labelFontSizeMm',
      allowZero = false,
    ) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.valueAsNumber;
      if (Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)) {
        updateExportSettings({ [name]: value });
      }
    };
  const updateStyle = (operation: OperationStyle['operation'], patch: Partial<OperationStyle>) => {
    updateExportSettings({
      operationStyles: settings.operationStyles.map((style) =>
        style.operation === operation ? { ...style, ...patch } : style,
      ),
    });
  };

  return (
    <section className="panel-section output-panel" aria-labelledby="output-heading">
      <div className="panel-heading-row">
        <p className="eyebrow">{t('Output')}</p>
        <span className="phase-badge">{t('Vector output')}</span>
      </div>
      <h2 id="output-heading">{copy.fabricationOutput}</h2>
      <p className="field-help output-intro">
        {t(
          'Preparation is applied only to exported and previewed paths. Generated source geometry stays unchanged.',
        )}
      </p>

      <div className="field-stack">
        <label htmlFor="fold-output">{copy.foldLineOutput}</label>
        <select
          id="fold-output"
          value={settings.foldLineOutput}
          onChange={(event) =>
            updateExportSettings({ foldLineOutput: event.target.value as FoldLineOutput })
          }
        >
          <option value="preserve">{t('Preserve mountain / valley layers')}</option>
          <option value="score">{t('Combine as score lines')}</option>
          <option value="perforate">{t('Perforation pattern')}</option>
        </select>
      </div>
      <div className="output-toggles">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={settings.includeLabels}
            onChange={(event) => updateExportSettings({ includeLabels: event.target.checked })}
          />
          <span>{copy.printableLabels}</span>
        </label>
      </div>
      {experienceMode === 'advanced' ? (
        <AdvancedSettingsSection>
          <div className="field-stack">
            <label htmlFor="kerf-mode">{copy.kerfCompensation}</label>
            <select
              id="kerf-mode"
              value={settings.kerfCompensation}
              onChange={(event) =>
                updateExportSettings({
                  kerfCompensation: event.target.value as KerfCompensationMode,
                })
              }
            >
              <option value="none">{t('None')}</option>
              <option value="material">
                {t('Material profile')} ({project.materialProfileSnapshot.kerfMm} mm)
              </option>
              <option value="custom">{t('Custom')}</option>
            </select>
          </div>
          {settings.kerfCompensation === 'custom' ? (
            <div className="field-stack">
              <label htmlFor="custom-kerf">{t('Custom kerf')}</label>
              <div className="unit-input">
                <input
                  id="custom-kerf"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.customKerfMm}
                  onChange={updateNumber('customKerfMm', true)}
                />
                <span>mm</span>
              </div>
            </div>
          ) : null}
          <p className="output-readout">
            {t('Applied kerf')} <strong>{prepared.appliedKerfMm} mm</strong>
          </p>
          {settings.foldLineOutput === 'perforate' ? (
            <div className="slice-number-grid">
              <div className="field-stack">
                <label htmlFor="perforation-dash">{t('Dash length')}</label>
                <div className="unit-input">
                  <input
                    id="perforation-dash"
                    type="number"
                    min="0.1"
                    step="0.25"
                    value={settings.perforationDashMm}
                    onChange={updateNumber('perforationDashMm')}
                  />
                  <span>mm</span>
                </div>
              </div>
              <div className="field-stack">
                <label htmlFor="perforation-gap">{t('Gap length')}</label>
                <div className="unit-input">
                  <input
                    id="perforation-gap"
                    type="number"
                    min="0"
                    step="0.25"
                    value={settings.perforationGapMm}
                    onChange={updateNumber('perforationGapMm', true)}
                  />
                  <span>mm</span>
                </div>
              </div>
            </div>
          ) : null}
          <div className="output-toggles">
            {settings.includeLabels ? (
              <div className="field-stack compact-field">
                <label htmlFor="label-size">{t('Label size')}</label>
                <div className="unit-input">
                  <input
                    id="label-size"
                    type="number"
                    min="1"
                    step="0.5"
                    value={settings.labelFontSizeMm}
                    onChange={updateNumber('labelFontSizeMm')}
                  />
                  <span>mm</span>
                </div>
              </div>
            ) : null}
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={settings.includeRegistrationMarks}
                onChange={(event) =>
                  updateExportSettings({ includeRegistrationMarks: event.target.checked })
                }
              />
              <span>{copy.registrationMarks}</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={settings.includeSheetBoundary}
                onChange={(event) =>
                  updateExportSettings({ includeSheetBoundary: event.target.checked })
                }
              />
              <span>{t('Sheet boundary')}</span>
            </label>
          </div>
          <section className="operation-style-editor" aria-labelledby="operation-styles-heading">
            <h4 id="operation-styles-heading">{copy.operationStyles}</h4>
            {settings.operationStyles.map((style) => (
              <div className="operation-style-row" key={style.operation}>
                <label htmlFor={`operation-colour-${style.operation}`}>
                  {t(operationLabels[style.operation])} {t('colour')}
                </label>
                <input
                  id={`operation-colour-${style.operation}`}
                  type="color"
                  value={style.stroke}
                  onChange={(event) => updateStyle(style.operation, { stroke: event.target.value })}
                />
                <label className="visually-hidden" htmlFor={`operation-width-${style.operation}`}>
                  {t(operationLabels[style.operation])} {t('width')}
                </label>
                <div className="unit-input">
                  <input
                    id={`operation-width-${style.operation}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={style.strokeWidthMm}
                    onChange={(event) => {
                      const value = event.target.valueAsNumber;
                      if (Number.isFinite(value) && value > 0)
                        updateStyle(style.operation, { strokeWidthMm: value });
                    }}
                  />
                  <span>mm</span>
                </div>
              </div>
            ))}
          </section>
        </AdvancedSettingsSection>
      ) : null}

      <div className="usage-card" aria-label={t('Material usage estimate')}>
        <div className="panel-heading-row">
          <strong>{t('Material estimate')}</strong>
          <span>{Math.round(usage.utilizationPercent * 10) / 10}% used</span>
        </div>
        <dl>
          <div>
            <dt>{t('Used sheets')}</dt>
            <dd>{usage.usedSheetCount}</dd>
          </div>
          <div>
            <dt>{t('Part area')}</dt>
            <dd>{areaLabel(usage.placedPartAreaMm2)}</dd>
          </div>
          <div>
            <dt>{t('Estimated waste')}</dt>
            <dd>{areaLabel(usage.estimatedWasteAreaMm2)}</dd>
          </div>
          <div>
            <dt>{t('Cut length')}</dt>
            <dd>{Math.round(usage.cutLengthMm)} mm</dd>
          </div>
        </dl>
        <p>
          {t(
            'Area is exact for closed contours and estimated from folding panels where applicable.',
          )}
        </p>
      </div>

      <div className="output-actions">
        <button
          type="button"
          disabled={
            !activeSheet || activeSheet.placements.length === 0 || hasOutputErrors || exportBlocked
          }
          onClick={() => activeSheet && createSheetSvgDownload(project, activeSheet.id, layouts)}
        >
          {t('Download active sheet SVG')}
        </button>
        <button
          className="primary-panel-action"
          type="button"
          disabled={!hasPlacedParts || hasOutputErrors || exportBlocked}
          onClick={() => createAssemblyPdfDownload(project, layouts)}
        >
          {copy.exportPdf}
        </button>
      </div>
      {prepared.issues.length > 0 ? (
        <p className="field-help output-issue-summary">
          {prepared.issues.length} output preparation notice
          {prepared.issues.length === 1 ? '' : 's'}. Review them in Inspect before exporting.
        </p>
      ) : null}
      {exportBlocked ? (
        <p className="field-help" role="status">
          {t('Export is disabled because generation is')} {copy.generationState[generationState]}.
        </p>
      ) : null}
    </section>
  );
}
