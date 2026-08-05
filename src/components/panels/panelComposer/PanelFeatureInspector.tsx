import type { ChangeEvent } from 'react';
import type { PanelFeature, PanelFeatureTargetRole } from '../../../domain/modeSettings';
import type { ExperienceMode } from '../../../state/types';
import { copy } from '../../../locales';
import { panelDimensionsForRole } from '../../../geometry/panelConstruction/panelFeatures';

function numberValue(event: ChangeEvent<HTMLInputElement>): number | undefined {
  return Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : undefined;
}

export function PanelFeatureInspector({
  feature,
  settings,
  experienceMode,
  onChange,
  onDuplicate,
  onDelete,
}: {
  feature: PanelFeature;
  settings: {
    innerWidthMm: number;
    innerDepthMm: number;
    innerHeightMm: number;
    includeLid: boolean;
  };
  experienceMode: ExperienceMode;
  onChange: (feature: PanelFeature) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const dimensions = panelDimensionsForRole(settings, feature.targetRole);
  const centreX =
    -dimensions.widthMm / 2 + feature.anchor.u * dimensions.widthMm + (feature.offsetMm?.x ?? 0);
  const centreY =
    -dimensions.heightMm / 2 + feature.anchor.v * dimensions.heightMm + (feature.offsetMm?.y ?? 0);
  const setCentre = (axis: 'x' | 'y', value: number) =>
    onChange({
      ...feature,
      anchor: { ...feature.anchor, [axis === 'x' ? 'u' : 'v']: 0.5 },
      offsetMm: {
        x: axis === 'x' ? value : (feature.offsetMm?.x ?? 0),
        y: axis === 'y' ? value : (feature.offsetMm?.y ?? 0),
      },
    });
  const availableRoles: PanelFeatureTargetRole[] = [
    'base',
    'front',
    'back',
    'left',
    'right',
    ...(settings.includeLid ? (['lid'] as const) : []),
  ];

  return (
    <section className="panel-feature-inspector" aria-labelledby="feature-inspector-heading">
      <div className="panel-heading-row">
        <h3 id="feature-inspector-heading">
          {feature.purpose ||
            (feature.kind === 'engraved-label' ? feature.text : copy.panelComposer.opening)}
        </h3>
        <code>{feature.id}</code>
      </div>
      <div className="field-stack">
        <label htmlFor="feature-target-panel">{copy.panelComposer.targetPanel}</label>
        <select
          id="feature-target-panel"
          value={feature.targetRole}
          onChange={(event) =>
            onChange({
              ...feature,
              targetRole: event.target.value as PanelFeatureTargetRole,
              anchor: { u: 0.5, v: 0.5 },
              offsetMm: { x: 0, y: 0 },
            })
          }
        >
          {availableRoles.map((role) => (
            <option key={role} value={role}>
              {copy.panelComposer.panelNames[role]}
            </option>
          ))}
        </select>
      </div>
      {feature.kind === 'rectangular-cutout' ? (
        <div className="slice-number-grid">
          <div className="field-stack">
            <label htmlFor="feature-width">{copy.panelComposer.width}</label>
            <input
              id="feature-width"
              type="number"
              min={0.1}
              step={1}
              value={feature.widthMm}
              onChange={(event) => {
                const value = numberValue(event);
                if (value !== undefined) onChange({ ...feature, widthMm: value });
              }}
            />
          </div>
          <div className="field-stack">
            <label htmlFor="feature-height">{copy.panelComposer.height}</label>
            <input
              id="feature-height"
              type="number"
              min={0.1}
              step={1}
              value={feature.heightMm}
              onChange={(event) => {
                const value = numberValue(event);
                if (value !== undefined) onChange({ ...feature, heightMm: value });
              }}
            />
          </div>
        </div>
      ) : feature.kind === 'circular-cutout' ? (
        <div className="field-stack">
          <label htmlFor="feature-diameter">{copy.panelComposer.diameter}</label>
          <input
            id="feature-diameter"
            type="number"
            min={0.1}
            step={1}
            value={feature.diameterMm}
            onChange={(event) => {
              const value = numberValue(event);
              if (value !== undefined) onChange({ ...feature, diameterMm: value });
            }}
          />
        </div>
      ) : (
        <>
          <div className="field-stack">
            <label htmlFor="feature-label-text">{copy.panelComposer.labelText}</label>
            <input
              id="feature-label-text"
              value={feature.text}
              maxLength={160}
              onChange={(event) => onChange({ ...feature, text: event.target.value })}
            />
          </div>
          <div className="field-stack">
            <label htmlFor="feature-font-size">{copy.panelComposer.labelSize}</label>
            <input
              id="feature-font-size"
              type="number"
              min={0.5}
              step={0.5}
              value={feature.fontSizeMm}
              onChange={(event) => {
                const value = numberValue(event);
                if (value !== undefined) onChange({ ...feature, fontSizeMm: value });
              }}
            />
          </div>
        </>
      )}
      <div className="slice-number-grid">
        <div className="field-stack">
          <label htmlFor="feature-centre-x">{copy.panelComposer.horizontalPosition}</label>
          <input
            id="feature-centre-x"
            type="number"
            step={1}
            value={Math.round(centreX * 1000) / 1000}
            onChange={(event) => {
              const value = numberValue(event);
              if (value !== undefined) setCentre('x', value);
            }}
          />
        </div>
        <div className="field-stack">
          <label htmlFor="feature-centre-y">{copy.panelComposer.verticalPosition}</label>
          <input
            id="feature-centre-y"
            type="number"
            step={1}
            value={Math.round(centreY * 1000) / 1000}
            onChange={(event) => {
              const value = numberValue(event);
              if (value !== undefined) setCentre('y', value);
            }}
          />
        </div>
      </div>
      <div className="feature-alignment-actions">
        <button type="button" onClick={() => setCentre('x', 0)}>
          {copy.panelComposer.centreHorizontally}
        </button>
        <button type="button" onClick={() => setCentre('y', 0)}>
          {copy.panelComposer.centreVertically}
        </button>
      </div>
      {experienceMode === 'advanced' ? (
        <div className="advanced-feature-fields">
          <div className="slice-number-grid">
            <div className="field-stack">
              <label htmlFor="feature-anchor-u">{copy.panelComposer.anchorU}</label>
              <input
                id="feature-anchor-u"
                type="number"
                step={0.01}
                value={feature.anchor.u}
                onChange={(event) => {
                  const value = numberValue(event);
                  if (value !== undefined)
                    onChange({ ...feature, anchor: { ...feature.anchor, u: value } });
                }}
              />
            </div>
            <div className="field-stack">
              <label htmlFor="feature-anchor-v">{copy.panelComposer.anchorV}</label>
              <input
                id="feature-anchor-v"
                type="number"
                step={0.01}
                value={feature.anchor.v}
                onChange={(event) => {
                  const value = numberValue(event);
                  if (value !== undefined)
                    onChange({ ...feature, anchor: { ...feature.anchor, v: value } });
                }}
              />
            </div>
          </div>
          <div className="field-stack">
            <label htmlFor="feature-rotation">{copy.panelComposer.rotation}</label>
            <input
              id="feature-rotation"
              type="number"
              step={1}
              value={feature.rotationDeg}
              onChange={(event) => {
                const value = numberValue(event);
                if (value !== undefined) onChange({ ...feature, rotationDeg: value });
              }}
            />
          </div>
          <div className="field-stack">
            <label htmlFor="feature-purpose">{copy.panelComposer.purpose}</label>
            <input
              id="feature-purpose"
              value={feature.purpose ?? ''}
              onChange={(event) => {
                const next = structuredClone(feature);
                if (event.target.value) next.purpose = event.target.value;
                else delete next.purpose;
                onChange(next);
              }}
            />
          </div>
          <button type="button" onClick={onDuplicate}>
            {copy.panelComposer.duplicate}
          </button>
        </div>
      ) : null}
      <button className="danger-action" type="button" onClick={onDelete}>
        {copy.panelComposer.deleteFeature}
      </button>
    </section>
  );
}
