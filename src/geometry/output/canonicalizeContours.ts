import type { FabricationPart } from '../../domain/fabrication';
import type { Point2D } from '../../domain/geometry';
import type { ValidationIssue } from '../../domain/validation';
import { EPS_AREA_MM2, EPS_LENGTH_MM } from '../designGraph/tolerances';
import {
  isSimplePolygon,
  pointInPolygon,
  signedArea,
  segmentsIntersect,
  polygonIntersectionArea,
  pointOnSegment,
  cross,
} from '../designGraph/polygons';
export const outputIssue = (
  code: string,
  ids: string[],
  message: string,
  severity: ValidationIssue['severity'] = 'error',
): ValidationIssue => ({
  id: `${code}:${ids.join(':')}`,
  code,
  severity,
  message,
  affectedEntityIds: ids,
  suggestedAction:
    'Inspect the highlighted geometry, correct the design or placement, and recalculate.',
});
export function cleanClosedLoop(points: readonly Point2D[]): Point2D[] {
  const loop = points.map((p) => ({ ...p }));
  if (
    loop.length > 3 &&
    Math.hypot(loop[0]!.x - loop.at(-1)!.x, loop[0]!.y - loop.at(-1)!.y) <= EPS_LENGTH_MM
  )
    loop.pop();
  let changed = true;
  while (changed && loop.length > 3) {
    changed = false;
    for (let i = 0; i < loop.length; i++) {
      const prior = loop[(i + loop.length - 1) % loop.length]!,
        next = loop[(i + 1) % loop.length]!;
      if (
        Math.abs(cross(prior, loop[i]!, next)) <= EPS_AREA_MM2 &&
        pointOnSegment(loop[i]!, prior, next)
      ) {
        loop.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return loop;
}
export function collinearOverlap(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  if (
    !pointOnSegment(c, a, b) &&
    !pointOnSegment(d, a, b) &&
    !pointOnSegment(a, c, d) &&
    !pointOnSegment(b, c, d)
  )
    return false;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length <= EPS_LENGTH_MM) return false;
  const cross = (p: Point2D) =>
    Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / length;
  if (cross(c) > EPS_LENGTH_MM || cross(d) > EPS_LENGTH_MM) return false;
  const project = (p: Point2D) => ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length;
  return (
    Math.min(length, Math.max(project(c), project(d))) -
      Math.max(0, Math.min(project(c), project(d))) >
    EPS_LENGTH_MM
  );
}
export function canonicalizeContours(source: readonly FabricationPart[]): {
  parts: FabricationPart[];
  issues: ValidationIssue[];
} {
  const parts = structuredClone(source) as FabricationPart[],
    issues: ValidationIssue[] = [],
    ids = new Set<string>();
  for (const part of parts) {
    if (ids.has(part.id))
      issues.push(outputIssue('OUTPUT_ID_DUPLICATE', [part.id], 'Duplicate part ID.'));
    ids.add(part.id);
    if (!Number.isFinite(part.thicknessMm) || part.thicknessMm <= 0)
      issues.push(
        outputIssue('OUTPUT_STOCK_INVALID', [part.id], 'Part stock thickness is invalid.'),
      );
    const pathIds = new Set<string>();
    for (const path of part.paths) {
      if (pathIds.has(path.id))
        issues.push(outputIssue('OUTPUT_ID_DUPLICATE', [part.id, path.id], 'Duplicate path ID.'));
      pathIds.add(path.id);
      if (path.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
        issues.push(
          outputIssue(
            'OUTPUT_COORDINATE_INVALID',
            [part.id, path.id],
            'Output coordinates must be finite.',
          ),
        );
      if (path.points.length < 2)
        issues.push(
          outputIssue(
            'OUTPUT_PATH_INVALID',
            [part.id, path.id],
            'A fabrication path needs at least two vertices.',
          ),
        );
      if (path.closed) {
        path.points = cleanClosedLoop(path.points);
        if (!isSimplePolygon(path.points))
          issues.push(
            outputIssue(
              'OUTPUT_CONTOUR_INVALID',
              [part.id, path.id],
              'Closed output contour is degenerate, touching itself or self-intersecting.',
            ),
          );
      }
    }
    if (
      part.labels?.some(
        (l) =>
          !Number.isFinite(l.position.x) ||
          !Number.isFinite(l.position.y) ||
          (l.fontSizeMm !== undefined && (!Number.isFinite(l.fontSizeMm) || l.fontSizeMm <= 0)),
      )
    )
      issues.push(
        outputIssue(
          'OUTPUT_LABEL_INVALID',
          [part.id],
          'Label position or physical size is invalid.',
        ),
      );
    const cuts = part.paths.filter(
      (p) => p.operation === 'cut' && p.closed && isSimplePolygon(p.points),
    );
    for (const path of cuts) {
      const containers = cuts.filter(
        (other) => other !== path && pointInPolygon(path.points[0]!, other.points, false),
      );
      const role = containers.length % 2 ? 'hole' : 'outer';
      if (path.contourRole && path.contourRole !== role)
        issues.push(
          outputIssue(
            'OUTPUT_CONTOUR_ROLE_INVALID',
            [part.id, path.id],
            'Contour role conflicts with nesting.',
          ),
        );
      path.contourRole = role;
      if (
        (role === 'outer' && signedArea(path.points) < 0) ||
        (role === 'hole' && signedArea(path.points) > 0)
      )
        path.points.reverse();
    }
    if (!cuts.some((p) => p.contourRole === 'outer'))
      issues.push(
        outputIssue(
          'PART_CONTOUR_UNVERIFIED',
          [part.id],
          'No validated closed exterior contour is available. Use inspection export until the perimeter is regenerated.',
        ),
      );
    if (cuts.filter((p) => p.contourRole === 'outer').length > 1)
      issues.push(
        outputIssue(
          'OUTPUT_PIECE_DISCONNECTED',
          [part.id],
          'Separate exterior loops must be separate physical parts.',
        ),
      );
    for (let i = 0; i < cuts.length; i++)
      for (let j = i + 1; j < cuts.length; j++) {
        const a = cuts[i]!,
          b = cuts[j]!;
        const touch = a.points.some((p, k) =>
          b.points.some((q, l) =>
            segmentsIntersect(
              p,
              a.points[(k + 1) % a.points.length]!,
              q,
              b.points[(l + 1) % b.points.length]!,
            ),
          ),
        );
        if (
          touch ||
          (a.contourRole === b.contourRole &&
            polygonIntersectionArea(a.points, b.points) > EPS_AREA_MM2)
        )
          issues.push(
            outputIssue(
              'OUTPUT_CONTOURS_OVERLAP',
              [part.id, a.id, b.id],
              'Cut contours overlap or touch.',
            ),
          );
      }
    const segments = part.paths
      .filter((p) => p.operation === 'cut')
      .flatMap((p) =>
        p.points
          .slice(0, p.closed ? undefined : -1)
          .map((a, i) => ({ id: p.id, a, b: p.points[(i + 1) % p.points.length]! })),
      );
    for (let i = 0; i < segments.length; i++)
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]!,
          b = segments[j]!;
        if (collinearOverlap(a.a, a.b, b.a, b.b))
          issues.push(
            outputIssue(
              'OUTPUT_DUPLICATE_CUT',
              [part.id, a.id, b.id],
              'Collinear physical cut segments overlap.',
            ),
          );
      }
  }
  return { parts, issues: [...new Map(issues.map((i) => [i.id, i])).values()] };
}
