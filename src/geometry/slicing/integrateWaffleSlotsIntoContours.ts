import type { FabricationPart, OpeningSlot } from '../../domain/fabrication';
import type { Point2D } from '../../domain/geometry';
import type { ValidationIssue } from '../../domain/validation';
import { EPS_AREA_MM2, EPS_LENGTH_MM } from '../designGraph/tolerances';
import {
  isSimplePolygon,
  pointOnSegment,
  pointInPolygon,
  segmentsIntersect,
  signedArea,
} from '../designGraph/polygons';
import { cleanClosedLoop, outputIssue } from '../output/canonicalizeContours';
export type { OpeningSlot } from '../../domain/fabrication';
const distance = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);
function pointSegmentDistance(p: Point2D, a: Point2D, b: Point2D) {
  const length = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (!length) return distance(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length),
  );
  return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}
/** Replace the verified exterior mouth arc with the U notch, retaining one physical cut contour. */
export function integrateWaffleSlotsIntoContours(part: FabricationPart): {
  part: FabricationPart;
  issues: ValidationIssue[];
  slots: OpeningSlot[];
} {
  const copy = structuredClone(part),
    outer = copy.paths.find((p) => p.operation === 'cut' && p.contourRole === 'outer'),
    slotPaths = copy.paths.filter((p) => p.slot),
    issues: ValidationIssue[] = [],
    slots: OpeningSlot[] = [];
  if (!outer || !isSimplePolygon(outer.points))
    return {
      part: copy,
      issues: [
        outputIssue(
          'WAFFLE_CONTOUR_INVALID',
          [part.id],
          'Waffle slots require one verified exterior contour.',
        ),
      ],
      slots,
    };
  const boundary = cleanClosedLoop(outer.points);
  if (signedArea(boundary) < 0) boundary.reverse();
  const lengths = boundary.map((p, i) => distance(p, boundary[(i + 1) % boundary.length]!)),
    prefix: number[] = [0];
  for (const length of lengths) prefix.push(prefix.at(-1)! + length);
  const perimeter = prefix.at(-1)!,
    mod = (value: number) => ((value % perimeter) + perimeter) % perimeter;
  const locate = (p: Point2D): number | undefined => {
    const locations = boundary.flatMap((a, i) => {
      const b = boundary[(i + 1) % boundary.length]!;
      if (!pointOnSegment(p, a, b)) return [];
      return [
        mod(
          prefix[i]! +
            Math.max(
              0,
              Math.min(
                lengths[i]!,
                ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / lengths[i]!,
              ),
            ),
        ),
      ];
    });
    if (
      !locations.length ||
      locations.some(
        (value) =>
          Math.min(Math.abs(value - locations[0]!), perimeter - Math.abs(value - locations[0]!)) >
          EPS_LENGTH_MM,
      )
    )
      return;
    return locations[0]!;
  };
  const edits: { start: number; length: number; points: Point2D[]; slot: OpeningSlot }[] = [],
    floor = 1.5 * part.thicknessMm;
  for (const path of slotPaths) {
    if (
      path.points.length !== 4 ||
      !path.slot ||
      path.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
    ) {
      issues.push(
        outputIssue(
          'WAFFLE_SLOT_INVALID',
          [part.id, path.id],
          'Opening slot needs four finite physical corners.',
        ),
      );
      continue;
    }
    const [a, c, d, b] = path.points as [Point2D, Point2D, Point2D, Point2D],
      aAt = locate(a),
      bAt = locate(b);
    if (aAt === undefined || bAt === undefined) {
      issues.push(
        outputIssue(
          'WAFFLE_ASSEMBLY_ACCESS_BLOCKED',
          [part.id, path.slot.pairedPartId, path.id],
          'Slot mouth is not on an unambiguous exterior border.',
        ),
      );
      continue;
    }
    const forward = mod(bAt - aAt),
      reverse = perimeter - forward;
    if (
      Math.abs(forward - reverse) <= EPS_LENGTH_MM ||
      Math.min(forward, reverse) <= EPS_LENGTH_MM
    ) {
      issues.push(
        outputIssue(
          'WAFFLE_ASSEMBLY_ACCESS_BLOCKED',
          [part.id, path.id],
          'Slot mouth arc is ambiguous or has zero length.',
        ),
      );
      continue;
    }
    const points = forward < reverse ? [a, c, d, b] : [b, d, c, a],
      start = forward < reverse ? aAt : bAt,
      arcLength = Math.min(forward, reverse);
    const depth = (distance(a, c) + distance(b, d)) / 2;
    if (
      path.slot.widthMm <= 0 ||
      path.slot.depthMm <= 0 ||
      Math.abs(distance(c, d) - path.slot.widthMm) > EPS_LENGTH_MM ||
      Math.abs(depth - path.slot.depthMm) > EPS_LENGTH_MM ||
      !pointInPolygon(c, boundary) ||
      !pointInPolygon(d, boundary)
    )
      issues.push(
        outputIssue(
          'WAFFLE_SLOT_LIGAMENT_INVALID',
          [part.id, path.id],
          'Slot corners or measured width/depth are inconsistent.',
        ),
      );
    const sharpCornerTooNear = boundary.some((p, i) => {
      const prior = boundary[(i + boundary.length - 1) % boundary.length]!,
        next = boundary[(i + 1) % boundary.length]!,
        u = { x: p.x - prior.x, y: p.y - prior.y },
        v = { x: next.x - p.x, y: next.y - p.y },
        angle = Math.acos(
          Math.max(
            -1,
            Math.min(1, (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y))),
          ),
        );
      return (
        angle > Math.PI / 6 && Math.min(distance(p, a), distance(p, b)) < floor - EPS_LENGTH_MM
      );
    });
    if (sharpCornerTooNear)
      issues.push(
        outputIssue(
          'WAFFLE_SLOT_LIGAMENT_INVALID',
          [part.id, path.id],
          'Slot opening leaves insufficient ligament at a sharp exterior corner.',
        ),
      );
    const exteriorLigamentTooSmall = boundary.some((q, i) => {
      const arcMiddle = mod(prefix[i]! + lengths[i]! / 2 - start);
      if (arcMiddle <= arcLength + EPS_LENGTH_MM) return false;
      return [c, d].some(
        (p) =>
          pointSegmentDistance(p, q, boundary[(i + 1) % boundary.length]!) < floor - EPS_LENGTH_MM,
      );
    });
    if (exteriorLigamentTooSmall)
      issues.push(
        outputIssue(
          'WAFFLE_SLOT_LIGAMENT_INVALID',
          [part.id, path.id],
          'Slot bottom leaves insufficient material at the exterior boundary.',
        ),
      );
    const holes = copy.paths.filter((p) => p.contourRole === 'hole');
    const touchingHole = holes.some(
      (h) =>
        [c, d].some((p) => pointInPolygon(p, h.points)) ||
        points
          .slice(0, -1)
          .some((p, i) =>
            h.points.some((q, j) =>
              segmentsIntersect(p, points[i + 1]!, q, h.points[(j + 1) % h.points.length]!),
            ),
          ),
    );
    const narrowHoleLigament = holes.some((h) =>
      [c, d].some((p) =>
        h.points.some(
          (q, j) =>
            pointSegmentDistance(p, q, h.points[(j + 1) % h.points.length]!) <
            floor - EPS_LENGTH_MM,
        ),
      ),
    );
    if (touchingHole || narrowHoleLigament)
      issues.push(
        outputIssue(
          'WAFFLE_ASSEMBLY_ACCESS_BLOCKED',
          [part.id, path.slot.pairedPartId, path.id],
          'Slot touches a hole or leaves insufficient internal ligament.',
        ),
      );
    const slot: OpeningSlot = {
      id: path.id,
      ...path.slot,
      mouth: [{ ...points[0]! }, { ...points[3]! }],
      inner: [{ ...points[1]! }, { ...points[2]! }],
    };
    slots.push(slot);
    edits.push({ start, length: arcLength, points, slot });
  }
  for (let i = 0; i < edits.length; i++)
    for (let j = i + 1; j < edits.length; j++) {
      const a = edits[i]!,
        b = edits[j]!,
        delta = mod(b.start - a.start),
        gapAfterA = delta - a.length,
        gapAfterB = perimeter - delta - b.length;
      if (gapAfterA < floor - EPS_LENGTH_MM || gapAfterB < floor - EPS_LENGTH_MM)
        issues.push(
          outputIssue(
            'WAFFLE_SLOT_MOUTHS_OVERLAP',
            [part.id, a.slot.id, b.slot.id],
            'Slot mouths overlap or leave insufficient ligament.',
          ),
        );
    }
  if (issues.length) return { part: copy, issues, slots };
  const seed = boundary.findIndex((_, i) =>
    edits.every((edit) => mod(prefix[i]! - edit.start) > edit.length + EPS_LENGTH_MM),
  );
  if (seed < 0 && edits.length)
    return {
      part: copy,
      issues: [
        outputIssue(
          'WAFFLE_ASSEMBLY_ACCESS_BLOCKED',
          [part.id],
          'Slot mouths leave no intact exterior boundary anchor.',
        ),
      ],
      slots,
    };
  const anchor = prefix[Math.max(0, seed)]!,
    events: { at: number; points: Point2D[] }[] = [];
  for (let i = 0; i < boundary.length; i++) {
    const at = mod(prefix[i]! - anchor);
    if (edits.every((edit) => mod(prefix[i]! - edit.start) > edit.length + EPS_LENGTH_MM))
      events.push({ at, points: [boundary[i]!] });
  }
  for (const edit of edits) events.push({ at: mod(edit.start - anchor), points: edit.points });
  const integrated = cleanClosedLoop(
    events.sort((a, b) => a.at - b.at).flatMap((event) => event.points),
  );
  if (
    !isSimplePolygon(integrated) ||
    signedArea(integrated) <= EPS_AREA_MM2 ||
    signedArea(integrated) > signedArea(boundary) + EPS_AREA_MM2
  )
    return {
      part: copy,
      issues: [
        outputIssue(
          'WAFFLE_CONTOUR_INVALID',
          [part.id],
          'Integrated slot perimeter is self-intersecting, degenerate or adds material.',
        ),
      ],
      slots,
    };
  outer.points = integrated;
  outer.closed = true;
  copy.paths = copy.paths.filter((p) => !p.slot);
  for (const slot of slots) {
    const a = slot.mouth[0],
      b = slot.mouth[1],
      c = slot.inner[0],
      d = slot.inner[1];
    copy.paths.push({
      id: `${slot.id}-guide`,
      operation: 'guide',
      closed: false,
      points: [
        { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 },
      ],
      slot: {
        pairedPartId: slot.pairedPartId,
        intersectionAxis: slot.intersectionAxis,
        centreMm: slot.centreMm,
        widthMm: slot.widthMm,
        depthMm: slot.depthMm,
        direction: slot.direction,
      },
    });
  }
  if (copy.waffle) copy.waffle.openingSlots = slots;
  return { part: copy, issues, slots };
}
