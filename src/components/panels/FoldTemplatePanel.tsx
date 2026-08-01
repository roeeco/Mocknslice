import type { ChangeEvent } from 'react';
import type { SliceAxis } from '../../domain/fabrication';
import type { ProjectedProfile, TemplateKind } from '../../domain/folding';
import type { Point2D } from '../../domain/geometry';
import { copy } from '../../locales/en';
import { useProjectStore } from '../../state/useProjectStore';

const axes: SliceAxis[] = ['x', 'y', 'z'];
const templates: { value: TemplateKind; label: string; description: string }[] = [
  {
    value: 'open-box',
    label: 'Open box',
    description: 'A fitted rectangular base with four walls.',
  },
  {
    value: 'box-with-lid',
    label: 'Box with lid',
    description: 'A fitted open box plus a separate lid.',
  },
  { value: 'tray', label: 'Tray', description: 'A shallow fitted rectangular tray.' },
  {
    value: 'sleeve',
    label: 'Profile sleeve',
    description: 'Convex end profiles joined by a wrapping band.',
  },
  {
    value: 'envelope',
    label: 'Profile envelope',
    description: 'Paired convex faces with a depth gusset.',
  },
  {
    value: 'regular-prism',
    label: 'Regular polygon prism',
    description: 'A configurable polygon circumscribed around the model.',
  },
  {
    value: 'pyramid-frustum',
    label: 'Pyramid / frustum',
    description: 'End profiles connected by tapered side panels.',
  },
];

function previewPoints(
  points: readonly Point2D[],
  minX: number,
  minY: number,
  scale: number,
): string {
  return points.map((point) => `${(point.x - minX) * scale},${(point.y - minY) * scale}`).join(' ');
}

function ProfilePreview({ profile }: { profile: ProjectedProfile }) {
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
        <strong>Projection check</strong>
        <span>{profile.clearanceMm} mm clearance</span>
      </div>
      <svg
        viewBox={`-8 -8 ${width + 16} ${height + 16}`}
        aria-label="Projected model and fitted profile"
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
      <label htmlFor={name}>{label}</label>
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

export function FoldTemplatePanel() {
  const project = useProjectStore((state) => state.project);
  const status = useProjectStore((state) => state.sliceGenerationStatus);
  const error = useProjectStore((state) => state.sliceGenerationError);
  const setModeParameter = useProjectStore((state) => state.setModeParameter);
  const generate = useProjectStore((state) => state.generateFoldTemplate);
  const cancel = useProjectStore((state) => state.cancelSliceGeneration);
  if (project.fabricationMode !== 'fold-template') return null;

  const parameters = project.modeParameters;
  const kind = (parameters.foldTemplateKind as TemplateKind | undefined) ?? 'open-box';
  const axis = (parameters.foldFitAxis as SliceAxis | undefined) ?? 'z';
  const currentTemplate = templates.find((candidate) => candidate.value === kind) ?? templates[0];
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
        <p className="eyebrow">Fabrication</p>
        <span className={`generation-status status-${status}`}>{status}</span>
      </div>
      <h2 id="fold-template-heading">{copy.foldingTemplate}</h2>
      <p className="field-help fold-intro">
        Fit a predictable paper or board construction around the model’s convex projection.
      </p>
      <fieldset disabled={status === 'processing'}>
        <div className="field-stack">
          <label htmlFor="foldTemplateKind">{copy.templateFamily}</label>
          <select
            id="foldTemplateKind"
            value={kind}
            onChange={(event) => setModeParameter('foldTemplateKind', event.target.value)}
          >
            {templates.map((template) => (
              <option value={template.value} key={template.value}>
                {template.label}
              </option>
            ))}
          </select>
          <p className="field-help">{currentTemplate?.description}</p>
        </div>
        <div className="slice-number-grid">
          <div className="field-stack">
            <label htmlFor="foldFitAxis">{copy.fittingAxis}</label>
            <select
              id="foldFitAxis"
              value={axis}
              onChange={(event) => setModeParameter('foldFitAxis', event.target.value)}
            >
              {axes.map((candidate) => (
                <option value={candidate} key={candidate}>
                  {candidate.toUpperCase()} axis
                </option>
              ))}
            </select>
          </div>
          <NumberField
            name="foldClearanceMm"
            label="Clearance"
            value={Number(
              parameters.foldClearanceMm ?? project.materialProfileSnapshot.clearanceMm,
            )}
            min={0}
            step={0.1}
            onChange={updateNumber('foldClearanceMm', true)}
          />
        </div>
        <NumberField
          name="foldProfileToleranceMm"
          label={copy.profileTolerance}
          value={Number(parameters.foldProfileToleranceMm ?? 1)}
          min={0.01}
          step={0.25}
          onChange={updateNumber('foldProfileToleranceMm')}
        />
        {boxLike ? (
          <div className="slice-number-grid">
            <NumberField
              name="foldWallHeightMm"
              label="Wall height"
              value={Number(parameters.foldWallHeightMm ?? 20)}
              onChange={updateNumber('foldWallHeightMm')}
            />
            <NumberField
              name="foldTabDepthMm"
              label="Glue tab depth"
              value={Number(parameters.foldTabDepthMm ?? 8)}
              onChange={updateNumber('foldTabDepthMm')}
            />
          </div>
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
          <div className="slice-number-grid">
            <NumberField
              name="foldGussetDepthMm"
              label="Gusset depth"
              value={Number(parameters.foldGussetDepthMm ?? 20)}
              onChange={updateNumber('foldGussetDepthMm')}
            />
            <NumberField
              name="foldClosureFlapMm"
              label="Closure flap"
              value={Number(parameters.foldClosureFlapMm ?? 12)}
              min={0}
              onChange={updateNumber('foldClosureFlapMm', true)}
            />
          </div>
        ) : null}
        {kind === 'regular-prism' ? (
          <div className="slice-number-grid">
            <NumberField
              name="foldPrismSides"
              label="Polygon sides"
              value={Number(parameters.foldPrismSides ?? 6)}
              min={3}
              max={12}
              step={1}
              unit="sides"
              onChange={updateRange('foldPrismSides', 3, 12)}
            />
            <NumberField
              name="foldPrismRotationDeg"
              label="Profile rotation"
              value={Number(parameters.foldPrismRotationDeg ?? 0)}
              min={-180}
              step={5}
              unit="°"
              onChange={updateFiniteNumber('foldPrismRotationDeg')}
            />
          </div>
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
        {['sleeve', 'envelope', 'regular-prism', 'pyramid-frustum'].includes(kind) ? (
          <NumberField
            name="foldSeamTabMm"
            label="Seam tab depth"
            value={Number(parameters.foldSeamTabMm ?? 8)}
            onChange={updateNumber('foldSeamTabMm')}
          />
        ) : null}
      </fieldset>
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
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {project.foldingResult ? <ProfilePreview profile={project.foldingResult.profile} /> : null}
    </section>
  );
}
