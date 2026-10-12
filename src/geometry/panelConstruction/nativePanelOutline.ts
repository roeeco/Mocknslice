import type { Point2D } from '../../domain/geometry';
import type { PanelEdgeName } from '../../domain/panelConstruction';
import type { PanelSpec, EdgeTreatment } from './constructionTypes';
import { panelOutline, edgeGeometry, pointAlong } from './fingerJoints';
import { booleanPerimeter } from '../designGraph/booleanPerimeter';
import { roundedPoint } from './constructionHelpers';
import { cleanPanelPerimeter } from './cleanPanelPerimeter';
/** Native panels use explicit material union/difference at intersecting corner treatments. */
export function nativePanelOutline(
  spec: PanelSpec,
  treatments: ReadonlyMap<PanelEdgeName, EdgeTreatment>,
): Point2D[] | undefined {
  const additions: Point2D[][] = [panelOutline(spec, new Map())],
    removals: Point2D[][] = [];
  for (const [edge, treatment] of treatments) {
    if (treatment.kind !== 'finger' || (edge === 'top' && spec.profile && spec.profile !== 'flat'))
      continue;
    const geometry = edgeGeometry(edge, spec.widthMm, spec.heightMm),
      length = Math.hypot(geometry.end.x - geometry.start.x, geometry.end.y - geometry.start.y),
      start = pointAlong(geometry.start, geometry.end, treatment.startGuardMm / length),
      end = pointAlong(geometry.start, geometry.end, 1 - treatment.endGuardMm / length);
    for (let i = 0; i < treatment.segmentCount; i++) {
      if (
        (i + treatment.phase) % 2 !== 0 ||
        (i === 0 && treatment.suppressStartFinger) ||
        (i === treatment.segmentCount - 1 && treatment.suppressEndFinger)
      )
        continue;
      const a = pointAlong(start, end, i / treatment.segmentCount),
        b = pointAlong(start, end, (i + 1) / treatment.segmentCount),
        segmentLength = Math.hypot(b.x - a.x, b.y - a.y),
        sign = treatment.relief === 'protrude' ? 1 : -1,
        inset = Math.max(-0.49, Math.min(0.49, (treatment.clearanceMm / 2 / segmentLength) * sign)),
        first = pointAlong(
          a,
          b,
          inset - (sign > 0 && i === 0 ? treatment.startFingerExtensionMm / segmentLength : 0),
        ),
        last = pointAlong(
          a,
          b,
          1 -
            inset +
            (sign > 0 && i === treatment.segmentCount - 1
              ? treatment.endFingerExtensionMm / segmentLength
              : 0),
        );
      const polygon = [
        first,
        {
          x: first.x + geometry.outward.x * treatment.depthMm * sign,
          y: first.y + geometry.outward.y * treatment.depthMm * sign,
        },
        {
          x: last.x + geometry.outward.x * treatment.depthMm * sign,
          y: last.y + geometry.outward.y * treatment.depthMm * sign,
        },
        last,
      ];
      (sign > 0 ? additions : removals).push(polygon);
    }
  }
  const loops = booleanPerimeter(additions, removals);
  if (!loops || loops.length !== 1) return;
  return cleanPanelPerimeter(loops[0]!.map(roundedPoint));
}
