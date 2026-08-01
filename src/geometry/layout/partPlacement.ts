import type { FabricationPart, SheetPlacement } from '../../domain/fabrication';
import type { Point2D } from '../../domain/geometry';

export interface Bounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsForPoints(points: Point2D[]): Bounds2D | undefined {
  if (points.length === 0) return undefined;
  return points.reduce<Bounds2D>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

export function boundsForPart(part: FabricationPart): Bounds2D | undefined {
  return boundsForPoints(part.paths.flatMap((path) => path.points));
}

export function rotatePoint(point: Point2D, rotationDeg: number): Point2D {
  const radians = (rotationDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  };
}

export function transformPoint(point: Point2D, placement: SheetPlacement): Point2D {
  const rotated = rotatePoint(point, placement.rotationDeg);
  return { x: rotated.x + placement.x, y: rotated.y + placement.y };
}

export function transformedBoundsForPart(
  part: FabricationPart,
  placement: SheetPlacement,
): Bounds2D | undefined {
  return boundsForPoints(
    part.paths.flatMap((path) => path.points.map((point) => transformPoint(point, placement))),
  );
}

export function dimensionsForBounds(bounds: Bounds2D): { width: number; height: number } {
  return { width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY };
}

export function normalizedRotation(rotationDeg: number): number {
  const normalized = rotationDeg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
