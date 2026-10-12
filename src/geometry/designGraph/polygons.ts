import type { Point2D } from '../../domain/geometry';
import { EPS_AREA_MM2, EPS_LENGTH_MM } from './tolerances';

export function cross(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function signedArea(points: readonly Point2D[]): number {
  return (
    points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length]!;
      return sum + a.x * b.y - b.x * a.y;
    }, 0) / 2
  );
}

export function pointOnSegment(p: Point2D, a: Point2D, b: Point2D): boolean {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length <= EPS_LENGTH_MM) return Math.hypot(p.x - a.x, p.y - a.y) <= EPS_LENGTH_MM;
  return (
    Math.abs(cross(a, b, p)) / length <= EPS_LENGTH_MM &&
    p.x >= Math.min(a.x, b.x) - EPS_LENGTH_MM &&
    p.x <= Math.max(a.x, b.x) + EPS_LENGTH_MM &&
    p.y >= Math.min(a.y, b.y) - EPS_LENGTH_MM &&
    p.y <= Math.max(a.y, b.y) + EPS_LENGTH_MM
  );
}

export function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  if (
    pointOnSegment(a, c, d) ||
    pointOnSegment(b, c, d) ||
    pointOnSegment(c, a, b) ||
    pointOnSegment(d, a, b)
  )
    return true;
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

export function isSimplePolygon(points: readonly Point2D[]): boolean {
  if (
    points.length > 3 &&
    Math.hypot(points[0]!.x - points.at(-1)!.x, points[0]!.y - points.at(-1)!.y) <= EPS_LENGTH_MM
  )
    points = points.slice(0, -1);
  if (
    points.length < 3 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)) ||
    Math.abs(signedArea(points)) <= EPS_AREA_MM2
  )
    return false;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!;
    if (Math.hypot(a.x - b.x, a.y - b.y) <= EPS_LENGTH_MM) return false;
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (segmentsIntersect(a, b, points[j]!, points[(j + 1) % points.length]!)) return false;
    }
  }
  return true;
}

export function pointInPolygon(
  point: Point2D,
  polygon: readonly Point2D[],
  includeBoundary = true,
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]!,
      b = polygon[i]!;
    if (pointOnSegment(point, a, b)) return includeBoundary;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

/** Deterministic ear clipping; rejects invalid/non-developable input rather than guessing. */
export function triangulatePolygon(polygon: readonly Point2D[]): Point2D[][] {
  if (!isSimplePolygon(polygon)) throw new Error('A simple polygon is required.');
  const points = signedArea(polygon) > 0 ? [...polygon] : [...polygon].reverse();
  // Remove only redundant collinear boundary points, retaining all physical corners.
  let removed = true;
  while (removed && points.length > 3) {
    removed = false;
    for (let i = 0; i < points.length; i++)
      if (
        pointOnSegment(
          points[i]!,
          points[(i + points.length - 1) % points.length]!,
          points[(i + 1) % points.length]!,
        )
      ) {
        points.splice(i, 1);
        removed = true;
        break;
      }
  }
  const triangles: Point2D[][] = [];
  while (points.length > 3) {
    let ear = -1;
    for (let i = 0; i < points.length; i++) {
      const a = points[(i + points.length - 1) % points.length]!,
        b = points[i]!,
        c = points[(i + 1) % points.length]!;
      if (cross(a, b, c) <= EPS_AREA_MM2) continue;
      if (
        points.some(
          (p, j) =>
            j !== i &&
            j !== (i + points.length - 1) % points.length &&
            j !== (i + 1) % points.length &&
            cross(a, b, p) >= -EPS_AREA_MM2 &&
            cross(b, c, p) >= -EPS_AREA_MM2 &&
            cross(c, a, p) >= -EPS_AREA_MM2,
        )
      )
        continue;
      ear = i;
      triangles.push([a, b, c]);
      break;
    }
    if (ear < 0) throw new Error('Polygon triangulation failed.');
    points.splice(ear, 1);
  }
  triangles.push(points);
  return triangles;
}

/** Convex clipping on CCW triangles; edge contact has zero area. */
export function convexIntersectionArea(
  first: readonly Point2D[],
  second: readonly Point2D[],
): number {
  let clipped = [...first];
  const clip = signedArea(second) > 0 ? second : [...second].reverse();
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i]!,
      b = clip[(i + 1) % clip.length]!;
    const source = clipped;
    clipped = [];
    for (let j = 0; j < source.length; j++) {
      const p = source[j]!,
        q = source[(j + 1) % source.length]!;
      const cp = cross(a, b, p),
        cq = cross(a, b, q);
      const pin = cp >= 0,
        qin = cq >= 0;
      if (pin) clipped.push(p);
      if (pin !== qin) {
        const t = cp / (cp - cq);
        clipped.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
    if (clipped.length === 0) return 0;
  }
  return Math.abs(signedArea(clipped));
}

export function polygonIntersectionArea(
  first: readonly Point2D[],
  second: readonly Point2D[],
): number {
  const a = triangulatePolygon(first),
    b = triangulatePolygon(second);
  return a.reduce(
    (sum, triangle) =>
      sum + b.reduce((inner, other) => inner + convexIntersectionArea(triangle, other), 0),
    0,
  );
}
