import type { FabricationPart, SheetLayout, SheetPlacement } from '../../domain/fabrication';
import type { ValidationIssue } from '../../domain/validation';
import { transformPoint, transformedBoundsForPart } from './partPlacement';
import { polygonIntersectionArea } from '../designGraph/polygons';
import { EPS_AREA_MM2, EPS_LENGTH_MM } from '../designGraph/tolerances';
import { boundsOf, boundsOverlap } from '../papercraft/intersection';
import { outputIssue, collinearOverlap } from '../output/canonicalizeContours';
function loopsFor(part: FabricationPart, placement: SheetPlacement) {
  return part.paths
    .filter((p) => p.operation === 'cut' && p.closed && p.contourRole)
    .map((p) => ({
      hole: p.contourRole === 'hole',
      points: p.points.map((point) => transformPoint(point, placement)),
    }));
}
/** Exact intersection of material regions, including holes; AABBs only prune candidates. */
export function placedPartIntersectionArea(
  a: FabricationPart,
  pa: SheetPlacement,
  b: FabricationPart,
  pb: SheetPlacement,
): number {
  const first = loopsFor(a, pa),
    second = loopsFor(b, pb);
  let area = 0;
  for (const x of first)
    for (const y of second)
      if (boundsOverlap(boundsOf(x.points), boundsOf(y.points)))
        area += (x.hole ? -1 : 1) * (y.hole ? -1 : 1) * polygonIntersectionArea(x.points, y.points);
  return Math.max(0, area);
}
export function intersectPlacedParts(
  parts: readonly FabricationPart[],
  layouts: readonly SheetLayout[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [],
    byId = new Map(parts.map((p) => [p.id, p])),
    counts = new Map<string, number>(),
    sheetIds = new Set<string>();
  for (const sheet of layouts) {
    if (sheetIds.has(sheet.id))
      issues.push(outputIssue('OUTPUT_SHEET_ID_DUPLICATE', [sheet.id], 'Duplicate sheet ID.'));
    sheetIds.add(sheet.id);
    if (
      ![sheet.widthMm, sheet.heightMm, sheet.marginMm, sheet.spacingMm].every(Number.isFinite) ||
      sheet.widthMm <= 0 ||
      sheet.heightMm <= 0 ||
      sheet.marginMm < 0 ||
      sheet.spacingMm < 0 ||
      sheet.marginMm * 2 >= Math.min(sheet.widthMm, sheet.heightMm)
    ) {
      issues.push(
        outputIssue(
          'SHEET_DIMENSIONS_INVALID',
          [sheet.id],
          'Sheet size and margins must leave a finite positive usable area.',
        ),
      );
      continue;
    }
    const valid: { part: FabricationPart; placement: SheetPlacement }[] = [];
    for (const placement of sheet.placements) {
      const part = byId.get(placement.partId);
      if (!part) {
        issues.push(
          outputIssue(
            'PLACEMENT_PART_MISSING',
            [sheet.id, placement.partId],
            'A placement refers to a nonexistent part.',
          ),
        );
        continue;
      }
      counts.set(part.id, (counts.get(part.id) ?? 0) + 1);
      if (![placement.x, placement.y, placement.rotationDeg].every(Number.isFinite)) {
        issues.push(
          outputIssue(
            'OUTPUT_PLACEMENT_INVALID',
            [sheet.id, part.id],
            'Placement transform must be finite.',
          ),
        );
        continue;
      }
      const bounds = transformedBoundsForPart(part, placement);
      if (!bounds) {
        issues.push(
          outputIssue('OUTPUT_PATH_INVALID', [part.id], 'Part has no physical geometry.'),
        );
        continue;
      }
      if (
        bounds.minX < sheet.marginMm - EPS_LENGTH_MM ||
        bounds.minY < sheet.marginMm - EPS_LENGTH_MM ||
        bounds.maxX > sheet.widthMm - sheet.marginMm + EPS_LENGTH_MM ||
        bounds.maxY > sheet.heightMm - sheet.marginMm + EPS_LENGTH_MM
      )
        issues.push(
          outputIssue(
            'PART_OUTSIDE_SHEET',
            [sheet.id, part.id],
            'Prepared geometry crosses the usable sheet boundary after compensation.',
          ),
        );
      valid.push({ part, placement });
    }
    for (let i = 0; i < valid.length; i++)
      for (let j = i + 1; j < valid.length; j++) {
        const a = valid[i]!,
          b = valid[j]!;
        const boxA = transformedBoundsForPart(a.part, a.placement)!,
          boxB = transformedBoundsForPart(b.part, b.placement)!;
        if (
          boxA.maxX < boxB.minX - EPS_LENGTH_MM ||
          boxB.maxX < boxA.minX - EPS_LENGTH_MM ||
          boxA.maxY < boxB.minY - EPS_LENGTH_MM ||
          boxB.maxY < boxA.minY - EPS_LENGTH_MM
        )
          continue;
        const segments = (part: FabricationPart, placement: SheetPlacement) =>
          part.paths
            .filter((p) => p.operation === 'cut')
            .flatMap((path) =>
              path.points.slice(0, path.closed ? undefined : -1).map((start, i) => ({
                a: transformPoint(start, placement),
                b: transformPoint(path.points[(i + 1) % path.points.length]!, placement),
              })),
            );
        const segmentsB = segments(b.part, b.placement);
        if (
          segments(a.part, a.placement).some((first) =>
            segmentsB.some((second) => collinearOverlap(first.a, first.b, second.a, second.b)),
          )
        )
          issues.push(
            outputIssue(
              'OUTPUT_DUPLICATE_CUT',
              [sheet.id, a.part.id, b.part.id],
              'Different placed parts repeat a physical cut segment.',
            ),
          );

        if (placedPartIntersectionArea(a.part, a.placement, b.part, b.placement) > EPS_AREA_MM2)
          issues.push(
            outputIssue(
              'PARTS_OVERLAP',
              [sheet.id, a.part.id, b.part.id],
              'Prepared physical part regions overlap.',
            ),
          );
      }
  }
  for (const part of parts) {
    const count = counts.get(part.id) ?? 0;
    if (count !== 1)
      issues.push(
        outputIssue(
          count ? 'PART_PLACED_MULTIPLE_TIMES' : 'PART_UNPLACED',
          [part.id],
          count ? 'Part is placed more than once.' : 'Part has no sheet placement.',
        ),
      );
  }
  return issues;
}
