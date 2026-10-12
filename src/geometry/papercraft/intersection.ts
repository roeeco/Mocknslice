import type { PapercraftFlatFace } from '../../domain/papercraft';
import type { Point2D } from '../../domain/geometry';
import { convexIntersectionArea, polygonIntersectionArea } from '../designGraph/polygons';
import { EPS_AREA_MM2 } from '../designGraph/tolerances';
export function boundsOf(points: readonly Point2D[]) {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}
export function boundsOverlap(a: ReturnType<typeof boundsOf>, b: ReturnType<typeof boundsOf>) {
  return (
    Math.min(a.maxX, b.maxX) > Math.max(a.minX, b.minX) &&
    Math.min(a.maxY, b.maxY) > Math.max(a.minY, b.minY)
  );
}
export function faceIslandsOverlap(
  a: readonly PapercraftFlatFace[],
  b: readonly PapercraftFlatFace[],
): boolean {
  const bounds = b.map((f) => boundsOf(f.points));
  for (const face of a) {
    const box = boundsOf(face.points);
    for (let i = 0; i < b.length; i++)
      if (
        boundsOverlap(box, bounds[i]!) &&
        convexIntersectionArea(face.points, b[i]!.points) > EPS_AREA_MM2
      )
        return true;
  }
  return false;
}
export function positivePolygonOverlap(a: readonly Point2D[], b: readonly Point2D[]) {
  return boundsOverlap(boundsOf(a), boundsOf(b)) && polygonIntersectionArea(a, b) > EPS_AREA_MM2;
}
