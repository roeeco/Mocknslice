import type { FabricationLabel, FabricationPart, FabricationPath } from '../../domain/fabrication';
import type { Point2D } from '../../domain/geometry';
import type {
  PanelConstructionMaterial,
  PanelConstructionPanel,
} from '../../domain/panelConstruction';
import type {
  EngravedLabelFeature,
  PanelComposerSettings,
  PanelFeature,
  PanelFeatureTargetRole,
} from '../../domain/modeSettings';
import type { ValidationIssue } from '../../domain/validation';

export const PANEL_FEATURE_CIRCLE_SEGMENTS = 48;
const EPSILON = 1e-7;
const MAX_LABEL_CHARACTERS = 80;

export interface ResolvedPanelFeature {
  feature: PanelFeature;
  panelId: string;
  partId: string;
  centreMm: Point2D;
  footprint: Point2D[];
  path?: FabricationPath;
  label?: FabricationLabel;
}

export interface PanelFeatureApplicationResult {
  parts: FabricationPart[];
  resolvedFeatures: ResolvedPanelFeature[];
  issues: ValidationIssue[];
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundedPoint(point: Point2D): Point2D {
  return { x: rounded(point.x), y: rounded(point.y) };
}

function rotate(point: Point2D, degrees: number): Point2D {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return roundedPoint({
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  });
}

function translated(points: readonly Point2D[], centre: Point2D, rotationDeg: number): Point2D[] {
  return points.map((point) => {
    const rotated = rotate(point, rotationDeg);
    return roundedPoint({ x: rotated.x + centre.x, y: rotated.y + centre.y });
  });
}

function rectangle(widthMm: number, heightMm: number): Point2D[] {
  const halfWidth = widthMm / 2;
  const halfHeight = heightMm / 2;
  return [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];
}

function circle(diameterMm: number): Point2D[] {
  const radius = diameterMm / 2;
  return Array.from({ length: PANEL_FEATURE_CIRCLE_SEGMENTS }, (_, index) => {
    const angle = (index / PANEL_FEATURE_CIRCLE_SEGMENTS) * Math.PI * 2;
    return roundedPoint({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });
}

function labelWidth(feature: EngravedLabelFeature): number {
  return Math.max(feature.fontSizeMm * 0.6, feature.text.length * feature.fontSizeMm * 0.6);
}

export function panelDimensionsForRole(
  settings: Pick<PanelComposerSettings, 'innerWidthMm' | 'innerDepthMm' | 'innerHeightMm'>,
  role: PanelFeatureTargetRole,
): { widthMm: number; heightMm: number } {
  if (role === 'base' || role === 'lid') {
    return { widthMm: settings.innerWidthMm, heightMm: settings.innerDepthMm };
  }
  if (role === 'front' || role === 'back') {
    return { widthMm: settings.innerWidthMm, heightMm: settings.innerHeightMm };
  }
  return { widthMm: settings.innerDepthMm, heightMm: settings.innerHeightMm };
}

export function panelLocalFeatureCentre(
  feature: PanelFeature,
  panel: Pick<PanelConstructionPanel, 'widthMm' | 'heightMm'>,
): Point2D {
  return roundedPoint({
    x: -panel.widthMm / 2 + feature.anchor.u * panel.widthMm + (feature.offsetMm?.x ?? 0),
    y: -panel.heightMm / 2 + feature.anchor.v * panel.heightMm + (feature.offsetMm?.y ?? 0),
  });
}

function physicalDimensionsValid(feature: PanelFeature): boolean {
  if (
    !feature.id.trim() ||
    !Number.isFinite(feature.anchor.u) ||
    !Number.isFinite(feature.anchor.v) ||
    !Number.isFinite(feature.rotationDeg) ||
    (feature.offsetMm &&
      (!Number.isFinite(feature.offsetMm.x) || !Number.isFinite(feature.offsetMm.y)))
  ) {
    return false;
  }
  if (feature.kind === 'rectangular-cutout') {
    return (
      Number.isFinite(feature.widthMm) &&
      feature.widthMm > 0 &&
      Number.isFinite(feature.heightMm) &&
      feature.heightMm > 0
    );
  }
  if (feature.kind === 'circular-cutout') {
    return Number.isFinite(feature.diameterMm) && feature.diameterMm > 0;
  }
  return (
    feature.text.trim().length > 0 && Number.isFinite(feature.fontSizeMm) && feature.fontSizeMm > 0
  );
}

export function resolvePanelFeature(
  feature: PanelFeature,
  panel: PanelConstructionPanel,
): ResolvedPanelFeature | undefined {
  if (!physicalDimensionsValid(feature)) return undefined;
  const centreMm = panelLocalFeatureCentre(feature, panel);
  const localFootprint =
    feature.kind === 'rectangular-cutout'
      ? rectangle(feature.widthMm, feature.heightMm)
      : feature.kind === 'circular-cutout'
        ? circle(feature.diameterMm)
        : rectangle(labelWidth(feature), feature.fontSizeMm);
  const footprint = translated(
    localFootprint,
    centreMm,
    feature.kind === 'circular-cutout' ? 0 : feature.rotationDeg,
  );
  const common = {
    feature,
    panelId: panel.id,
    partId: panel.partId,
    centreMm,
    footprint,
  };
  if (feature.kind === 'engraved-label') {
    return {
      ...common,
      label: {
        id: `${feature.id}-label`,
        text: feature.text,
        position: centreMm,
        operation: 'engrave',
        entityId: feature.id,
        featureId: feature.id,
        fontSizeMm: rounded(feature.fontSizeMm),
        rotationDeg: rounded(feature.rotationDeg),
      },
    };
  }
  return {
    ...common,
    path: {
      id: `${feature.id}-cutout`,
      operation: 'cut',
      closed: true,
      contourRole: 'hole',
      panelId: panel.id,
      featureId: feature.id,
      points: footprint,
    },
  };
}

function orientation(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(point: Point2D, start: Point2D, end: Point2D): boolean {
  return (
    Math.abs(orientation(start, end, point)) <= EPSILON &&
    point.x >= Math.min(start.x, end.x) - EPSILON &&
    point.x <= Math.max(start.x, end.x) + EPSILON &&
    point.y >= Math.min(start.y, end.y) - EPSILON &&
    point.y <= Math.max(start.y, end.y) + EPSILON
  );
}

function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const firstC = orientation(a, b, c);
  const firstD = orientation(a, b, d);
  const secondA = orientation(c, d, a);
  const secondB = orientation(c, d, b);
  if (firstC * firstD < -EPSILON && secondA * secondB < -EPSILON) return true;
  return (
    (Math.abs(firstC) <= EPSILON && onSegment(c, a, b)) ||
    (Math.abs(firstD) <= EPSILON && onSegment(d, a, b)) ||
    (Math.abs(secondA) <= EPSILON && onSegment(a, c, d)) ||
    (Math.abs(secondB) <= EPSILON && onSegment(b, c, d))
  );
}

function pointInPolygon(point: Point2D, polygon: readonly Point2D[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index]!;
    const b = polygon[previous]!;
    if (onSegment(point, a, b)) return true;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonsOverlap(first: readonly Point2D[], second: readonly Point2D[]): boolean {
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const firstStart = first[firstIndex]!;
    const firstEnd = first[(firstIndex + 1) % first.length]!;
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      if (
        segmentsIntersect(
          firstStart,
          firstEnd,
          second[secondIndex]!,
          second[(secondIndex + 1) % second.length]!,
        )
      ) {
        return true;
      }
    }
  }
  return pointInPolygon(first[0]!, second) || pointInPolygon(second[0]!, first);
}

function pointSegmentDistance(point: Point2D, start: Point2D, end: Point2D): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (start.x + dx * ratio), point.y - (start.y + dy * ratio));
}

function polygonDistance(first: readonly Point2D[], second: readonly Point2D[]): number {
  if (polygonsOverlap(first, second)) return 0;
  let minimum = Number.POSITIVE_INFINITY;
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const firstStart = first[firstIndex]!;
    const firstEnd = first[(firstIndex + 1) % first.length]!;
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const secondStart = second[secondIndex]!;
      const secondEnd = second[(secondIndex + 1) % second.length]!;
      minimum = Math.min(
        minimum,
        pointSegmentDistance(firstStart, secondStart, secondEnd),
        pointSegmentDistance(firstEnd, secondStart, secondEnd),
        pointSegmentDistance(secondStart, firstStart, firstEnd),
        pointSegmentDistance(secondEnd, firstStart, firstEnd),
      );
    }
  }
  return minimum;
}

function containedBy(footprint: readonly Point2D[], outline: readonly Point2D[]): boolean {
  return footprint.every((point) => pointInPolygon(point, outline));
}

function featureName(feature: PanelFeature): string {
  return feature.purpose?.trim() || (feature.kind === 'engraved-label' ? feature.text : feature.id);
}

function issue(
  feature: PanelFeature,
  code: string,
  message: string,
  severity: 'warning' | 'error' = 'error',
  affectedEntityIds: string[] = [feature.id],
  suggestedAction?: string,
): ValidationIssue {
  return {
    id: `${code.toLowerCase()}-${affectedEntityIds.join('-')}`,
    severity,
    code,
    message,
    messageArgs: { feature: featureName(feature) },
    affectedEntityIds,
    ...(suggestedAction ? { suggestedAction } : {}),
  };
}

function smallestDimension(feature: PanelFeature): number | undefined {
  if (feature.kind === 'rectangular-cutout') return Math.min(feature.widthMm, feature.heightMm);
  if (feature.kind === 'circular-cutout') return feature.diameterMm;
  return undefined;
}

export function applyPanelFeatures(
  features: readonly PanelFeature[],
  panels: readonly PanelConstructionPanel[],
  parts: readonly FabricationPart[],
  material: PanelConstructionMaterial,
  thicknessForRole: (role: PanelFeature['targetRole']) => number = () => material.thicknessMm,
): PanelFeatureApplicationResult {
  const panelsByRole = new Map(panels.map((panel) => [panel.role, panel]));
  const baseParts = parts.map((part) => ({
    ...part,
    paths: [...part.paths],
    labels: part.labels ? [...part.labels] : [],
  }));
  const partsById = new Map(baseParts.map((part) => [part.id, part]));
  const issues: ValidationIssue[] = [];
  const resolvedFeatures: ResolvedPanelFeature[] = [];

  for (const feature of [...features].sort((left, right) => left.id.localeCompare(right.id))) {
    const panel = panelsByRole.get(feature.targetRole);
    if (!panel) {
      issues.push(
        issue(
          feature,
          'PANEL_FEATURE_TARGET_MISSING',
          `${featureName(feature)} targets a panel that is not present.`,
          'error',
          [feature.id, `construction-panel-${feature.targetRole}`],
          'Choose an available panel or enable the required lid.',
        ),
      );
      continue;
    }
    const resolved = resolvePanelFeature(feature, panel);
    if (!resolved) {
      issues.push(
        issue(
          feature,
          'PANEL_FEATURE_DIMENSIONS_INVALID',
          `${featureName(feature)} has invalid physical dimensions or coordinates.`,
          'error',
          [feature.id, panel.id],
          'Enter finite coordinates and positive physical dimensions.',
        ),
      );
      continue;
    }
    resolvedFeatures.push(resolved);
    const part = partsById.get(panel.partId)!;
    if (resolved.path) part.paths.push(resolved.path);
    if (resolved.label) part.labels.push(resolved.label);
  }

  for (const resolved of resolvedFeatures) {
    const { feature, footprint } = resolved;
    const panel = panelsByRole.get(feature.targetRole)!;
    const part = partsById.get(panel.partId)!;
    if (!containedBy(footprint, panel.outline)) {
      issues.push(
        issue(
          feature,
          'PANEL_FEATURE_OUTSIDE_PANEL',
          `${featureName(feature)} extends outside ${panel.name}.`,
          'error',
          [feature.id, panel.id],
          'Move the feature inward or reduce its dimensions.',
        ),
      );
    } else {
      const boundaryDistance = polygonDistance(footprint, panel.outline);
      const requiredClearance = Math.max(
        1,
        thicknessForRole(feature.targetRole),
        material.kerfMm * 2,
      );
      if (boundaryDistance < requiredClearance - EPSILON) {
        issues.push(
          issue(
            feature,
            'PANEL_FEATURE_EDGE_CLEARANCE',
            `${featureName(feature)} is too close to the outer panel edge.`,
            'warning',
            [feature.id, panel.id],
            `Keep at least ${rounded(requiredClearance)} mm from the outer edge.`,
          ),
        );
      }
    }
    const minimumSize = smallestDimension(feature);
    if (minimumSize !== undefined && minimumSize <= Math.max(0.5, material.kerfMm * 2)) {
      issues.push(
        issue(
          feature,
          'PANEL_FEATURE_TOO_SMALL_FOR_KERF',
          `${featureName(feature)} is too small relative to the material kerf.`,
          'error',
          [feature.id, material.id],
          'Enlarge the opening or choose a lower-kerf process.',
        ),
      );
    }
    if (
      feature.kind === 'engraved-label' &&
      (feature.text.length > MAX_LABEL_CHARACTERS || labelWidth(feature) > panel.widthMm * 0.9)
    ) {
      issues.push(
        issue(
          feature,
          'PANEL_FEATURE_LABEL_TOO_LONG',
          `${featureName(feature)} is too long for a reliable panel label.`,
          'warning',
          [feature.id, panel.id],
          'Shorten the label, reduce its size, or choose a wider panel.',
        ),
      );
    }
    const receiverPaths = part.paths.filter(
      (path) => path.contourRole === 'hole' && !path.featureId && path.points.length >= 3,
    );
    if (receiverPaths.some((path) => polygonsOverlap(footprint, path.points))) {
      issues.push(
        issue(
          feature,
          'PANEL_FEATURE_JOINT_CONFLICT',
          `${featureName(feature)} conflicts with a joint or receiver slot.`,
          'error',
          [feature.id, panel.id],
          'Move or resize the feature so it clears every joint and slot.',
        ),
      );
    }
  }

  for (let first = 0; first < resolvedFeatures.length; first += 1) {
    for (let second = first + 1; second < resolvedFeatures.length; second += 1) {
      const left = resolvedFeatures[first]!;
      const right = resolvedFeatures[second]!;
      if (left.panelId !== right.panelId || !polygonsOverlap(left.footprint, right.footprint)) {
        continue;
      }
      issues.push(
        issue(
          left.feature,
          'PANEL_FEATURE_OVERLAP',
          `${featureName(left.feature)} overlaps ${featureName(right.feature)}.`,
          'error',
          [left.feature.id, right.feature.id, left.panelId],
          'Move or resize one of the overlapping features.',
        ),
      );
    }
  }

  return { parts: baseParts, resolvedFeatures, issues };
}
