import type { Point2D } from '../../domain/geometry';
import { cross, signedArea, isSimplePolygon } from '../designGraph/polygons';
import { EPS_AREA_MM2, EPS_LENGTH_MM } from '../designGraph/tolerances';
/** Remove only zero-area collinear retraces introduced by nominal finger corner guards. */
export function cleanPanelPerimeter(source: readonly Point2D[]): Point2D[] | undefined {
  const points = source.map((p) => ({ ...p }));
  let changed = true;
  while (changed && points.length > 3) {
    changed = false;
    for (let i = 0; i < points.length; i++) {
      const prior = points[(i + points.length - 1) % points.length]!,
        current = points[i]!,
        next = points[(i + 1) % points.length]!;
      if (
        Math.hypot(current.x - prior.x, current.y - prior.y) <= EPS_LENGTH_MM ||
        Math.abs(cross(prior, current, next)) <= EPS_AREA_MM2
      ) {
        points.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  const tolerance = Math.max(EPS_AREA_MM2, Math.abs(signedArea(source)) * Number.EPSILON * 128);
  if (!isSimplePolygon(points) || Math.abs(signedArea(points) - signedArea(source)) > tolerance)
    return;
  return points;
}
