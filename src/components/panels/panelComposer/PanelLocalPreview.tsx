import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Point2D } from '../../../domain/geometry';
import type {
  PanelComposerSettings,
  PanelFeature,
  PanelFeatureTargetRole,
} from '../../../domain/modeSettings';
import type { PanelConstructionPanel } from '../../../domain/panelConstruction';
import {
  panelDimensionsForRole,
  resolvePanelFeature,
} from '../../../geometry/panelConstruction/panelFeatures';
import { profiledPanelOutline } from '../../../geometry/panelConstruction/panelProfiles';
import { copy } from '../../../locales';

interface FeatureDrag {
  featureId: string;
  pointerId: number;
  mode: 'move' | 'resize';
  start: Point2D;
  original: PanelFeature;
  delta: Point2D;
}

function pointsAttribute(points: readonly Point2D[]): string {
  return points.map((point) => `${point.x},${-point.y}`).join(' ');
}

function localPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point2D | undefined {
  const matrix = svg.getScreenCTM();
  if (!matrix) return undefined;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: -transformed.y };
}

function movedFeature(feature: PanelFeature, delta: Point2D): PanelFeature {
  return {
    ...feature,
    offsetMm: {
      x: (feature.offsetMm?.x ?? 0) + delta.x,
      y: (feature.offsetMm?.y ?? 0) + delta.y,
    },
  };
}

function resizedFeature(feature: PanelFeature, delta: Point2D): PanelFeature {
  if (feature.kind === 'engraved-label') return feature;
  if (feature.kind === 'circular-cutout') {
    return { ...feature, diameterMm: Math.max(0.1, feature.diameterMm + delta.x * 2) };
  }
  const radians = (feature.rotationDeg * Math.PI) / 180;
  const localX = delta.x * Math.cos(radians) + delta.y * Math.sin(radians);
  const localY = -delta.x * Math.sin(radians) + delta.y * Math.cos(radians);
  return {
    ...feature,
    widthMm: Math.max(0.1, feature.widthMm + localX * 2),
    heightMm: Math.max(0.1, feature.heightMm + localY * 2),
  };
}

function previewFeature(drag: FeatureDrag): PanelFeature {
  return drag.mode === 'move'
    ? movedFeature(drag.original, drag.delta)
    : resizedFeature(drag.original, drag.delta);
}

function featureDimensions(feature: PanelFeature): string | undefined {
  const format = (value: number) => String(Math.round(value * 1_000) / 1_000);
  if (feature.kind === 'rectangular-cutout') {
    return `${format(feature.widthMm)} × ${format(feature.heightMm)} mm`;
  }
  if (feature.kind === 'circular-cutout') return `Ø ${format(feature.diameterMm)} mm`;
  return undefined;
}

function resizeHandlePoint(feature: PanelFeature, centre: Point2D): Point2D | undefined {
  if (feature.kind === 'engraved-label') return undefined;
  if (feature.kind === 'circular-cutout') {
    return { x: centre.x + feature.diameterMm / 2, y: centre.y };
  }
  const radians = (feature.rotationDeg * Math.PI) / 180;
  const halfWidth = feature.widthMm / 2;
  const halfHeight = feature.heightMm / 2;
  return {
    x: centre.x + halfWidth * Math.cos(radians) - halfHeight * Math.sin(radians),
    y: centre.y + halfWidth * Math.sin(radians) + halfHeight * Math.cos(radians),
  };
}

export function PanelLocalPreview({
  settings,
  panelRole,
  exactPanel,
  selectedFeatureId,
  onSelectFeature,
  onCommitFeature,
}: {
  settings: PanelComposerSettings;
  panelRole: PanelFeatureTargetRole;
  exactPanel?: PanelConstructionPanel;
  selectedFeatureId?: string;
  onSelectFeature: (feature: PanelFeature) => void;
  onCommitFeature: (feature: PanelFeature) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<FeatureDrag>();
  const dimensions = panelDimensionsForRole(settings, panelRole);
  const profile =
    panelRole === 'front' || panelRole === 'back' ? settings.panelProfiles[panelRole] : 'flat';
  const panel = useMemo<PanelConstructionPanel>(
    () =>
      exactPanel ?? {
        id: `construction-panel-${panelRole}`,
        partId: `construction-part-${panelRole}`,
        name: copy.panelComposer.panelNames[panelRole],
        role: panelRole,
        widthMm: dimensions.widthMm,
        heightMm: dimensions.heightMm,
        outline: profiledPanelOutline(profile, dimensions.widthMm, dimensions.heightMm),
        edgeJointIds: {},
      },
    [dimensions.heightMm, dimensions.widthMm, exactPanel, panelRole, profile],
  );
  const features = settings.features
    .filter((feature) => feature.targetRole === panelRole)
    .map((feature) => (drag?.featureId === feature.id ? previewFeature(drag) : feature));
  const selectedPreviewFeature = features.find((feature) => feature.id === selectedFeatureId);
  const selectedDimensions = selectedPreviewFeature
    ? featureDimensions(selectedPreviewFeature)
    : undefined;
  const margin = Math.max(12, Math.min(dimensions.widthMm, dimensions.heightMm) * 0.12);
  const panelBounds = panel.outline.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  const viewWidth = panelBounds.maxX - panelBounds.minX + margin * 2;
  const viewHeight = panelBounds.maxY - panelBounds.minY + margin * 2;

  const beginInteraction = (
    event: PointerEvent<SVGElement>,
    feature: PanelFeature,
    mode: FeatureDrag['mode'],
  ) => {
    if (event.button !== 0 || !svgRef.current) return;
    const start = localPoint(svgRef.current, event.clientX, event.clientY);
    if (!start) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectFeature(feature);
    setDrag({
      featureId: feature.id,
      pointerId: event.pointerId,
      mode,
      start,
      original: structuredClone(feature),
      delta: { x: 0, y: 0 },
    });
  };
  const continueDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = localPoint(event.currentTarget, event.clientX, event.clientY);
    if (!point) return;
    let delta = { x: point.x - drag.start.x, y: point.y - drag.start.y };
    if (drag.mode === 'move' && event.shiftKey) {
      delta = Math.abs(delta.x) >= Math.abs(delta.y) ? { x: delta.x, y: 0 } : { x: 0, y: delta.y };
    }
    setDrag({
      ...drag,
      delta,
    });
  };
  const finishDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.abs(drag.delta.x) > 1e-6 || Math.abs(drag.delta.y) > 1e-6) {
      onCommitFeature(previewFeature(drag));
    }
    setDrag(undefined);
  };
  const moveWithKeyboard = (event: KeyboardEvent<SVGGElement>, feature: PanelFeature) => {
    const directions: Partial<Record<string, Point2D>> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: 1 },
      ArrowDown: { x: 0, y: -1 },
    };
    const direction = directions[event.key];
    if (!direction) {
      if (event.key === 'Enter' || event.key === ' ') onSelectFeature(feature);
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
    onCommitFeature(movedFeature(feature, { x: direction.x * step, y: direction.y * step }));
  };

  return (
    <div className="panel-local-preview-shell">
      <svg
        ref={svgRef}
        className="panel-local-preview"
        viewBox={`${panelBounds.minX - margin} ${-panelBounds.maxY - margin} ${viewWidth} ${viewHeight}`}
        aria-label={`${copy.panelComposer.localPreview}: ${copy.panelComposer.panelNames[panelRole]}`}
        onPointerMove={continueDrag}
        onPointerUp={finishDrag}
        onPointerCancel={() => setDrag(undefined)}
      >
        <polygon
          points={pointsAttribute(panel.outline)}
          className="panel-local-outline"
          fillRule="evenodd"
        />
        <line
          className="panel-local-axis"
          x1={-dimensions.widthMm / 2}
          y1="0"
          x2={dimensions.widthMm / 2}
          y2="0"
        />
        <line
          className="panel-local-axis"
          x1="0"
          y1={-dimensions.heightMm / 2}
          x2="0"
          y2={dimensions.heightMm / 2}
        />
        {features.map((feature) => {
          const resolved = resolvePanelFeature(feature, panel);
          if (!resolved) return null;
          const selected = selectedFeatureId === feature.id;
          const resizeHandle = selected ? resizeHandlePoint(feature, resolved.centreMm) : undefined;
          return (
            <g
              key={feature.id}
              className={`panel-local-feature${selected ? ' is-selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${feature.purpose || (feature.kind === 'engraved-label' ? feature.text : copy.panelComposer.opening)}. ${copy.panelComposer.keyboardMoveHelp}`}
              aria-pressed={selected}
              data-feature-id={feature.id}
              onClick={() => onSelectFeature(feature)}
              onPointerDown={(event) => beginInteraction(event, feature, 'move')}
              onKeyDown={(event) => moveWithKeyboard(event, feature)}
            >
              {feature.kind === 'engraved-label' ? (
                <text
                  x={resolved.centreMm.x}
                  y={-resolved.centreMm.y}
                  transform={
                    feature.rotationDeg
                      ? `rotate(${-feature.rotationDeg} ${resolved.centreMm.x} ${-resolved.centreMm.y})`
                      : undefined
                  }
                  fontSize={feature.fontSizeMm}
                  textAnchor="middle"
                >
                  {feature.text}
                </text>
              ) : (
                <>
                  <polygon
                    className="panel-feature-hit-target"
                    points={pointsAttribute(resolved.footprint)}
                  />
                  <polygon points={pointsAttribute(resolved.footprint)} />
                </>
              )}
              {selected ? (
                <>
                  <circle
                    className="panel-feature-handle"
                    cx={resolved.centreMm.x}
                    cy={-resolved.centreMm.y}
                    r={Math.max(3, Math.min(dimensions.widthMm, dimensions.heightMm) * 0.03)}
                  />
                  {resizeHandle ? (
                    <circle
                      className="panel-feature-resize-handle"
                      cx={resizeHandle.x}
                      cy={-resizeHandle.y}
                      r={Math.max(4, Math.min(dimensions.widthMm, dimensions.heightMm) * 0.035)}
                      role="button"
                      tabIndex={0}
                      aria-label={copy.panelComposer.resizeHandle}
                      onPointerDown={(event) => beginInteraction(event, feature, 'resize')}
                    />
                  ) : null}
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
      {selectedDimensions ? (
        <output
          className="panel-feature-dimensions"
          aria-label={copy.panelComposer.openingDimensions}
        >
          {selectedDimensions}
        </output>
      ) : null}
      <p className="field-help">
        {copy.panelComposer.coordinateHelp} {copy.panelComposer.dragSnapHelp}
      </p>
    </div>
  );
}
