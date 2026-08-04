import type { ChangeEvent } from 'react';
import { TEMPLATE_KINDS, type ProjectedProfile, type TemplateKind } from '../../domain/folding';
import type { Point2D } from '../../domain/geometry';
import { copy, t } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';
import { AdvancedSettingsSection } from './AdvancedSettingsSection';
import { RuntimeFailureMessage } from '../RuntimeFailureMessage';

const templateDescriptions: Record<TemplateKind, string> = {
  'open-box': 'A fitted rectangular base with four walls.',
  'box-with-lid': 'A fitted open box plus a separate lid.',
  tray: 'A shallow fitted rectangular tray.',
  sleeve: 'Four-sided end sections joined by a wrapping band.',
  envelope: 'Paired rectangular faces with a depth gusset.',
  'regular-prism': 'A configurable regular polygon with a chosen extrusion length.',
  'pyramid-frustum': 'Rectangular ends connected by tapered side panels.',
};

function previewPoints(
  points: readonly Point2D[],
  minX: number,
  minY: number,
  scale: number,
): string {
  return points.map((point) => `${(point.x - minX) * scale},${(point.y - minY) * scale}`).join(' ');
}

export function FoldProfilePreview({ profile }: { profile: ProjectedProfile }) {
  const all = [...profile.sourceHullPoints, ...profile.fittedPoints];
  const minX = Math.min(...all.map((point) => point.x));
  const minY = Math.min(...all.map((point) => point.y));
  const maxX = Math.max(...all.map((point) => point.x));
  const maxY = Math.max(...all.map((point) => point.y));
  const scale = Math.min(150 / Math.max(maxX - minX, 1), 90 / Math.max(maxY - minY, 1));
  const width = Math.max(1, (maxX - minX) * scale);
  const height = Math.max(1, (maxY - minY) * scale);
  return (
    <div className="profile-preview" data-testid="fold-profile-preview">
      <div className="panel-heading-row">
        <strong>{t('Projection check')}</strong>
        <span>{profile.clearanceMm} mm clearance</span>
      </div>
      <svg
        viewBox={`-8 -8 ${width + 16} ${height + 16}`}
        aria-label={t('Projected model and fitted profile')}
      >
        <polygon
          className="fitted-profile"
          points={previewPoints(profile.fittedPoints, minX, minY, scale)}
        />
        <polygon
          className="source-profile"
          points={previewPoints(profile.sourceHullPoints, minX, minY, scale)}
        />
      </svg>
      <div className="profile-legend">
        <span>
          <i className="source-key" />
          Model projection
        </span>
        <span>
          <i className="fit-key" />
          Fitted profile
        </span>
      </div>
    </div>
  );
}

interface NumberFieldProps {
  name: string;
  label: string;
  value: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

function NumberField({
  name,
  label,
  value,
  onChange,
  min = 0.1,
  max,
  step = 0.5,
  unit = 'mm',
}: NumberFieldProps) {
  return (
    <div className="field-stack">
      <label htmlFor={name}>{t(label)}</label>
      <div className="unit-input">
        <input
          id={name}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
        />
        <span>{unit}</span>
      </div>
    </div>
  );
}

export function FoldTemplatePanel({
  hideGenerationAction = false,
}: { hideGenerationAction?: boolean } = {}) {
  const project = useProjectStore((state) => state.project);
  const experienceMode = useProjectStore((state) => state.experienceMode);
  const status = useProjectStore((state) => state.sliceGenerationStatus);
  const error = useProjectStore((state) => state.sliceGenerationError);
  const setModeParameter = useProjectStore((state) => state.setModeParameter);
  const generate = useProjectStore((state) => state.generateFoldTemplate);
  const cancel = useProjectStore((state) => state.cancelSliceGeneration);
  if (project.fabricationMode !== 'fold-template') return null;

  const parameters = project.modeParameters;
  const kind = (parameters.foldTemplateKind as TemplateKind | undefined) ?? 'open-box';
  const templateDimensions = {
    widthMm: Number(parameters.foldWidthMm ?? 80),
    lengthMm: Number(parameters.foldLengthMm ?? 60),
    heightMm: Number(parameters.foldHeightMm ?? 40),
  };
  const closureMethod = parameters.foldClosureMethod === 'press-fit' ? 'press-fit' : 'glue';
  const updateNumber =
    (name: string, allowZero = false) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.valueAsNumber;
      if (Number.isFinite(value) && (allowZero ? value >= 0 : value > 0))
        setModeParameter(name, value);
    };
  const updateFiniteNumber = (name: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.valueAsNumber;
    if (Number.isFinite(value)) setModeParameter(name, value);
  };
  const updateRange =
    (name: string, min: number, max: number) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.valueAsNumber;
      if (Number.isFinite(value) && value >= min && value <= max) setModeParameter(name, value);
    };
  const boxLike = kind === 'open-box' || kind === 'box-with-lid' || kind === 'tray';

  return (
    <section
      className="panel-section slice-panel fold-template-panel"
      aria-labelledby="fold-template-heading"
    >
      <div className="panel-heading-row">
        <p className="eyebrow">{t('Fabrication')}</p>
        <span className={`generation-status status-${status}`}>
          {copy.generationStatus[status]}
        </span>
      </div>
      <h2 id="fold-template-heading">{copy.foldingTemplate}</h2>
      <p className="field-help fold-intro">
        {t('Create a parametric folding form directly from its finished dimensions.')}
      </p>
      <fieldset disabled={status === 'processing'}>
        <div className="field-stack">
          <label htmlFor="foldTemplateKind">{copy.templateFamily}</label>
          <select
            id="foldTemplateKind"
            value={kind}
            onChange={(event) => setModeParameter('foldTemplateKind', event.target.value)}
          >
            {TEMPLATE_KINDS.map((templateKind) => (
              <option value={templateKind} key={templateKind}>
                {copy.templateNames[templateKind]}
              </option>
            ))}
          </select>
          <p className="field-help">{t(templateDescriptions[kind])}</p>
        </div>
        <div className="template-dimension-grid">
          <NumberField
            name="foldWidthMm"
            label="Width (X)"
            value={templateDimensions.widthMm}
            onChange={updateNumber('foldWidthMm')}
          />
          <NumberField
            name="foldLengthMm"
            label="Length / depth (Z)"
            value={templateDimensions.lengthMm}
            onChange={updateNumber('foldLengthMm')}
          />
          <NumberField
            name="foldHeightMm"
            label="Height (Y)"
            value={templateDimensions.heightMm}
            onChange={updateNumber('foldHeightMm')}
          />
        </div>
        {kind === 'regular-prism' ? (
          <NumberField
            name="foldPrismSides"
            label="Polygon sides"
            value={Number(parameters.foldPrismSides ?? 6)}
            min={3}
            max={12}
            step={1}
            unit={t('sides')}
            onChange={updateRange('foldPrismSides', 3, 12)}
          />
        ) : null}
        {kind === 'pyramid-frustum' ? (
          <NumberField
            name="foldTopScale"
            label="Top scale (0 = pyramid)"
            value={Number(parameters.foldTopScale ?? 0)}
            min={0}
            max={1}
            step={0.1}
            unit="×"
            onChange={updateRange('foldTopScale', 0, 1)}
          />
        ) : null}
        {experienceMode === 'advanced' ? (
          <AdvancedSettingsSection>
            <div className="slice-number-grid">
              <div className="field-stack">
                <label htmlFor="fold-closure-method">{t('Connection method')}</label>
                <select
                  id="fold-closure-method"
                  value={closureMethod}
                  onChange={(event) => setModeParameter('foldClosureMethod', event.target.value)}
                >
                  <option value="glue">{t('Glue tabs')}</option>
                  <option value="press-fit">{t('Press-fit lips and slits')}</option>
                </select>
              </div>
              {closureMethod === 'press-fit' ? (
                <NumberField
                  name="foldSlotClearanceMm"
                  label={t('Slit clearance')}
                  value={Number(
                    parameters.foldSlotClearanceMm ?? project.materialProfileSnapshot.clearanceMm,
                  )}
                  min={0}
                  step={0.05}
                  onChange={updateNumber('foldSlotClearanceMm', true)}
                />
              ) : null}
            </div>
            {boxLike ? (
              <NumberField
                name="foldTabDepthMm"
                label={closureMethod === 'press-fit' ? 'Press-fit lip depth' : 'Glue tab depth'}
                value={Number(parameters.foldTabDepthMm ?? 8)}
                onChange={updateNumber('foldTabDepthMm')}
              />
            ) : null}
            {kind === 'box-with-lid' ? (
              <div className="slice-number-grid">
                <NumberField
                  name="foldLidDepthMm"
                  label="Lid wall depth"
                  value={Number(parameters.foldLidDepthMm ?? 15)}
                  onChange={updateNumber('foldLidDepthMm')}
                />
                <NumberField
                  name="foldLidClearanceMm"
                  label="Lid clearance"
                  value={Number(parameters.foldLidClearanceMm ?? 0.5)}
                  min={0}
                  step={0.1}
                  onChange={updateNumber('foldLidClearanceMm', true)}
                />
              </div>
            ) : null}
            {kind === 'envelope' ? (
              <NumberField
                name="foldClosureFlapMm"
                label="Closure flap"
                value={Number(parameters.foldClosureFlapMm ?? 12)}
                min={0}
                onChange={updateNumber('foldClosureFlapMm', true)}
              />
            ) : null}
            {kind === 'regular-prism' ? (
              <NumberField
                name="foldPrismRotationDeg"
                label="Profile rotation"
                value={Number(parameters.foldPrismRotationDeg ?? 0)}
                min={-180}
                step={5}
                unit="°"
                onChange={updateFiniteNumber('foldPrismRotationDeg')}
              />
            ) : null}
            {['sleeve', 'envelope', 'regular-prism', 'pyramid-frustum'].includes(kind) ? (
              <NumberField
                name="foldSeamTabMm"
                label={closureMethod === 'press-fit' ? 'Press-fit lip depth' : 'Seam tab depth'}
                value={Number(parameters.foldSeamTabMm ?? 8)}
                onChange={updateNumber('foldSeamTabMm')}
              />
            ) : null}
            <div className="slice-number-grid">
              <NumberField
                name="foldClearanceMm"
                label="Fit clearance"
                value={Number(
                  parameters.foldClearanceMm ?? project.materialProfileSnapshot.clearanceMm,
                )}
                min={0}
                step={0.1}
                onChange={updateNumber('foldClearanceMm', true)}
              />
              <NumberField
                name="foldProfileToleranceMm"
                label="Profile tolerance"
                value={Number(parameters.foldProfileToleranceMm ?? 1)}
                min={0.01}
                step={0.1}
                onChange={updateNumber('foldProfileToleranceMm')}
              />
            </div>
          </AdvancedSettingsSection>
        ) : null}
      </fieldset>
      {!hideGenerationAction ? (
        <div className="generation-actions">
          {status === 'processing' ? (
            <button type="button" onClick={cancel}>
              {copy.cancelGeneration}
            </button>
          ) : (
            <button className="primary-panel-action" type="button" onClick={generate}>
              {status === 'stale' ? 'Regenerate template' : copy.generateTemplate}
            </button>
          )}
          <span aria-live="polite">
            {status === 'processing'
              ? 'Fitting profile…'
              : project.foldingResult
                ? `${project.foldingResult.panels.length} panels · ${project.foldingResult.tabs.length} tabs`
                : 'Ready to fit'}
          </span>
        </div>
      ) : null}
      {error ? (
        <p className="inline-error" role="alert">
          <RuntimeFailureMessage failure={error} />
        </p>
      ) : null}
      {!hideGenerationAction &&
      project.foldingResult &&
      project.modeParameters.workflowSourceMode !== 'template' ? (
        <FoldProfilePreview profile={project.foldingResult.profile} />
      ) : null}
    </section>
  );
}
