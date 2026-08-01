import type { SliceAxis } from '../../domain/fabrication';
import type { ProjectedProfile, TemplateFitSettings } from '../../domain/folding';
import type { Bounds3D, Point2D, SerializableTriangleMesh, Vector3Mm } from '../../domain/geometry';
import type { ValidationIssue } from '../../domain/validation';

export const FOLDING_ALGORITHM_VERSION = 'standalone-template-v3';

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function projectPoint(x: number, y: number, z: number, axis: SliceAxis): Point2D {
  if (axis === 'x') return { x: z, y };
  if (axis === 'y') return { x, y: z };
  return { x, y };
}

function cross(origin: Point2D, a: Point2D, b: Point2D): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

export function convexHull(points: readonly Point2D[]): Point2D[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length <= 1) return sorted;
  const lower: Point2D[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: Point2D[] = [];
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function polygonArea(points: readonly Point2D[]): number {
  return (
    points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length]!;
      return area + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

function lineIntersection(
  firstPoint: Point2D,
  firstDirection: Point2D,
  secondPoint: Point2D,
  secondDirection: Point2D,
): Point2D | undefined {
  const denominator = firstDirection.x * secondDirection.y - firstDirection.y * secondDirection.x;
  if (Math.abs(denominator) < 1e-10) return undefined;
  const dx = secondPoint.x - firstPoint.x;
  const dy = secondPoint.y - firstPoint.y;
  const factor = (dx * secondDirection.y - dy * secondDirection.x) / denominator;
  return {
    x: firstPoint.x + firstDirection.x * factor,
    y: firstPoint.y + firstDirection.y * factor,
  };
}

export function offsetConvexPolygon(
  polygon: readonly Point2D[],
  clearanceMm: number,
): Point2D[] | undefined {
  if (polygon.length < 3) return undefined;
  if (clearanceMm === 0) return polygon.map((point) => ({ ...point }));
  const shiftedLines = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]!;
    const direction = { x: next.x - point.x, y: next.y - point.y };
    const length = Math.hypot(direction.x, direction.y);
    if (length <= 1e-10) return undefined;
    const outward = { x: direction.y / length, y: -direction.x / length };
    return {
      point: {
        x: point.x + outward.x * clearanceMm,
        y: point.y + outward.y * clearanceMm,
      },
      direction,
    };
  });
  if (shiftedLines.some((line) => !line)) return undefined;
  const result: Point2D[] = [];
  for (let index = 0; index < shiftedLines.length; index += 1) {
    const previous = shiftedLines[(index - 1 + shiftedLines.length) % shiftedLines.length]!;
    const current = shiftedLines[index]!;
    const intersection = lineIntersection(
      previous.point,
      previous.direction,
      current.point,
      current.direction,
    );
    if (!intersection || !Number.isFinite(intersection.x) || !Number.isFinite(intersection.y))
      return undefined;
    result.push(intersection);
  }
  return result;
}

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function containsConvex(container: readonly Point2D[], points: readonly Point2D[]): boolean {
  return points.every((point) =>
    container.every((start, index) => {
      const end = container[(index + 1) % container.length]!;
      return cross(start, end, point) >= -1e-5;
    }),
  );
}

function simplifyConvexEnclosure(
  polygon: readonly Point2D[],
  toleranceMm: number,
  minimumEdgeMm: number,
): Point2D[] {
  if (
    polygon.length <= 24 &&
    polygon.every(
      (point, index) => distance(point, polygon[(index + 1) % polygon.length]!) >= minimumEdgeMm,
    )
  ) {
    return polygon.map((point) => ({ ...point }));
  }
  const threshold = Math.max(toleranceMm, minimumEdgeMm);
  const selected: number[] = [0];
  let accumulated = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    accumulated += distance(polygon[index]!, polygon[(index + 1) % polygon.length]!);
    if (accumulated >= threshold && index + 1 < polygon.length) {
      selected.push(index + 1);
      accumulated = 0;
    }
  }
  let indices = [...new Set(selected)];
  if (indices.length > 24) {
    indices = Array.from({ length: 24 }, (_, index) =>
      Math.floor((index * indices.length) / 24),
    ).map((index) => indices[index]!);
  }
  indices = [...new Set(indices)];
  if (indices.length < 3 || indices.length >= polygon.length)
    return polygon.map((point) => ({ ...point }));
  const lines = indices.map((index) => {
    const point = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    return { point, direction: { x: next.x - point.x, y: next.y - point.y } };
  });
  const candidate: Point2D[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const previous = lines[(index - 1 + lines.length) % lines.length]!;
    const current = lines[index]!;
    const intersection = lineIntersection(
      previous.point,
      previous.direction,
      current.point,
      current.direction,
    );
    if (!intersection || !Number.isFinite(intersection.x) || !Number.isFinite(intersection.y))
      return polygon.map((point) => ({ ...point }));
    candidate.push(intersection);
  }
  return polygonArea(candidate) > 0 && containsConvex(candidate, polygon)
    ? candidate
    : polygon.map((point) => ({ ...point }));
}

function deduplicatedProjectedPoints(
  mesh: SerializableTriangleMesh,
  axis: SliceAxis,
  toleranceMm: number,
): Point2D[] {
  const safeTolerance = Math.max(toleranceMm, 1e-6);
  const points = new Map<string, Point2D>();
  for (let index = 0; index < mesh.positionsMm.length; index += 3) {
    const point = projectPoint(
      mesh.positionsMm[index] ?? 0,
      mesh.positionsMm[index + 1] ?? 0,
      mesh.positionsMm[index + 2] ?? 0,
      axis,
    );
    const key = `${Math.round(point.x / safeTolerance)}:${Math.round(point.y / safeTolerance)}`;
    if (!points.has(key)) points.set(key, point);
  }
  return [...points.values()];
}

function axisExtent(bounds: Bounds3D, axis: SliceAxis): { min: number; max: number } {
  const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  return { min: bounds.minMm[index], max: bounds.maxMm[index] };
}

function profileBounds(points: readonly Point2D[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

export function extractProjectedProfile(input: {
  mesh: SerializableTriangleMesh;
  bounds: Bounds3D;
  modelId: string;
  settings: TemplateFitSettings;
  materialThicknessMm: number;
}): { profile?: ProjectedProfile; issues: ValidationIssue[] } {
  const { mesh, bounds, modelId, settings, materialThicknessMm } = input;
  const issues: ValidationIssue[] = [];
  const projected = deduplicatedProjectedPoints(
    mesh,
    settings.fitAxis,
    Math.min(settings.profileToleranceMm, 0.001),
  );
  const hull = convexHull(projected);
  if (hull.length < 3 || Math.abs(polygonArea(hull)) <= 1e-8) {
    issues.push({
      id: `profile-zero-area-${modelId}`,
      severity: 'error',
      code: 'PROFILE_ZERO_AREA',
      message: 'The selected fitting axis produces a zero-area projection.',
      affectedEntityIds: [modelId],
      suggestedAction: 'Choose another fitting axis or inspect the source mesh.',
    });
    return { issues };
  }
  const offset = offsetConvexPolygon(hull, settings.clearanceMm);
  if (!offset) {
    issues.push({
      id: `profile-offset-failed-${modelId}`,
      severity: 'error',
      code: 'PROFILE_OFFSET_FAILED',
      message: 'The convex profile could not be offset by the requested clearance.',
      affectedEntityIds: [modelId],
      suggestedAction: 'Reduce clearance or choose another fitting axis.',
    });
    return { issues };
  }
  const minimumEdgeMm = Math.max(2, materialThicknessMm * 2);
  const fitted = simplifyConvexEnclosure(offset, settings.profileToleranceMm, minimumEdgeMm);
  if (fitted.length < offset.length) {
    issues.push({
      id: `profile-simplified-${modelId}`,
      severity: 'warning',
      code: 'PROFILE_SIMPLIFIED',
      message: `The fitted profile was simplified from ${offset.length} to ${fitted.length} edges.`,
      affectedEntityIds: [modelId],
      suggestedAction: 'Review the source and fitted outlines before fabrication.',
    });
  }
  if (fitted.length > 24) {
    issues.push({
      id: `profile-complex-${modelId}`,
      severity: 'warning',
      code: 'PROFILE_COMPLEXITY_HIGH',
      message: `The fitted profile has ${fitted.length} edges and may produce a difficult template.`,
      affectedEntityIds: [modelId],
      suggestedAction: 'Increase profile tolerance to reduce panel count.',
    });
  }
  const profileExtent = profileBounds(fitted);
  const widthMm = profileExtent.maxX - profileExtent.minX;
  const heightMm = profileExtent.maxY - profileExtent.minY;
  if (Math.min(widthMm, heightMm) < minimumEdgeMm) {
    issues.push({
      id: `profile-feature-narrow-${modelId}`,
      severity: 'error',
      code: 'PROFILE_FEATURE_TOO_NARROW',
      message: 'The fitted profile is narrower than the selected material can support.',
      affectedEntityIds: [modelId],
      suggestedAction: 'Use thinner material, scale the model up, or choose another axis.',
    });
  }
  const extent = axisExtent(bounds, settings.fitAxis);
  const profile: ProjectedProfile = {
    sourceModelId: modelId,
    fitAxis: settings.fitAxis,
    sourceHullPoints: hull.map((point) => ({ x: rounded(point.x), y: rounded(point.y) })),
    fittedPoints: fitted.map((point) => ({ x: rounded(point.x), y: rounded(point.y) })),
    clearanceMm: rounded(settings.clearanceMm),
    simplificationToleranceMm: rounded(settings.profileToleranceMm),
    axisMinMm: rounded(extent.min - settings.clearanceMm),
    axisMaxMm: rounded(extent.max + settings.clearanceMm),
    widthMm: rounded(widthMm),
    heightMm: rounded(heightMm),
    depthMm: rounded(extent.max - extent.min + settings.clearanceMm * 2),
  };
  return { profile, issues };
}

export function profilePointToWorld(
  point: Point2D,
  axisPositionMm: number,
  fitAxis: SliceAxis,
): Vector3Mm {
  if (fitAxis === 'x') return [axisPositionMm, point.y, point.x];
  if (fitAxis === 'y') return [point.x, axisPositionMm, point.y];
  return [point.x, point.y, axisPositionMm];
}

export function deterministicFoldingHash(input: {
  mesh: SerializableTriangleMesh;
  settings: TemplateFitSettings;
  materialThicknessMm: number;
}): string {
  const source = JSON.stringify({
    ...(input.settings.parameters.standalone === true
      ? {}
      : { positionsMm: input.mesh.positionsMm, indices: input.mesh.indices }),
    settings: input.settings,
    materialThicknessMm: input.materialThicknessMm,
    algorithmVersion: FOLDING_ALGORITHM_VERSION,
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `sf6-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
