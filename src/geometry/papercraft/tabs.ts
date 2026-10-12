import type { Point2D } from '../../domain/geometry';
import type {
  PapercraftKernelInput,
  PapercraftKernelResult,
  PapercraftRunHooks,
  PapercraftTab,
} from '../../domain/papercraft';
import type { ValidationIssue } from '../../domain/validation';
import { isSimplePolygon } from '../designGraph/polygons';
import { EPS_LENGTH_MM } from '../designGraph/tolerances';
import { flatEdge, distance } from './edgeGeometry';
import { positivePolygonOverlap } from './intersection';
import { uniqueSourceEdges } from './unfoldForest';
import { tracePapercraftPerimeter, type PapercraftContour } from './tracePerimeter';
import { papercraftIssue } from './prepareSource';

export type { PapercraftTab } from '../../domain/papercraft';
/** Source host is CCW. The tab extends to the right of its directed boundary edge. */
export function makePapercraftTab(
  a: Point2D,
  b: Point2D,
  depthMm: number,
  shoulderAngleDeg: number,
): PapercraftTab['outline'] {
  const length = distance(a, b),
    dx = (b.x - a.x) / length,
    dy = (b.y - a.y) / length;
  const inset = Math.min(
    0.3 * depthMm,
    0.2 * length,
    depthMm / Math.tan((shoulderAngleDeg * Math.PI) / 180),
  );
  return [
    { ...a },
    { x: a.x + dx * inset + dy * depthMm, y: a.y + dy * inset - dx * depthMm },
    { x: b.x - dx * inset + dy * depthMm, y: b.y - dy * inset - dx * depthMm },
    { ...b },
  ];
}
export function contoursWithTabs(
  contours: readonly PapercraftContour[],
  tabs: readonly PapercraftTab[],
): Point2D[][] {
  return contours.map((contour) =>
    contour.segments.flatMap((segment) => {
      const tab = tabs.find(
        (t) =>
          t.status === 'enabled' &&
          t.ownerFaceId === segment.faceId &&
          t.edgeKey === segment.edgeKey,
      );
      return tab ? tab.outline.slice(0, 3) : [segment.a];
    }),
  );
}
export function fitTabToPerimeter(
  targetDepthMm: number,
  minimumDepthMm: number,
  maximumDepthMm: number,
  build: (depth: number) => PapercraftTab,
  valid: (tab: PapercraftTab) => boolean,
): PapercraftTab | undefined {
  const start = Math.min(targetDepthMm, maximumDepthMm, 15);
  if (start + EPS_LENGTH_MM < minimumDepthMm) return;
  for (let depth = start; depth >= minimumDepthMm - EPS_LENGTH_MM; depth -= 0.5) {
    const candidate = build(Math.max(depth, minimumDepthMm));
    if (valid(candidate)) return candidate;
  }
  // Check the exact physical floor even when target is not a multiple of the shrink step.
  if (start > minimumDepthMm) {
    const candidate = build(minimumDepthMm);
    if (valid(candidate)) return candidate;
  }
}
export function buildPapercraftTabs(
  result: PapercraftKernelResult,
  input: PapercraftKernelInput,
  hooks: PapercraftRunHooks = {},
): { tabs: PapercraftTab[]; issues: ValidationIssue[] } {
  const tabs: PapercraftTab[] = [],
    issues: ValidationIssue[] = [],
    byEdge = new Map(result.source.halfEdges.map((e) => [e.id, e])),
    byFace = new Map(result.faces.map((f) => [f.id, f]));
  const minimumDepthMm = Math.max(1, 1.5 * input.materialThicknessMm);
  for (const edge of uniqueSourceEdges(result.source).filter(
    (e) => !result.hingeKeys.includes(e.edgeKey),
  )) {
    if (hooks.cancelled?.())
      throw new DOMException('Papercraft calculation cancelled.', 'AbortError');
    hooks.progress?.({
      stage: 'tabs',
      done: tabs.length,
      total: uniqueSourceEdges(result.source).length - result.hingeKeys.length,
    });
    const opposite = byEdge.get(edge.oppositeId!);
    if (!opposite) continue;
    const edit = input.settings.edgeEdits.find((e) => e.id === edge.edgeKey),
      preference = edit?.tab.owner;
    const ownerEdges =
      preference === 'face-b' ? [opposite] : preference === 'face-a' ? [edge] : [edge, opposite];
    let fitted: PapercraftTab | undefined, example: PapercraftTab | undefined;
    for (const owner of ownerEdges) {
      const receiver = byEdge.get(owner.oppositeId!)!,
        face = byFace.get(owner.faceId)!,
        receiverFace = byFace.get(receiver.faceId)!,
        island = result.islands.find((i) => i.faceIds.includes(face.id))!;
      const [a, b] = flatEdge(face, owner),
        [rA, rB] = flatEdge(receiverFace, receiver),
        third = receiverFace.points.find(
          (_, i) =>
            ![receiver.startVertex, receiver.endVertex].includes(receiverFace.vertexIds[i]!),
        )!;
      const clearance =
        Math.abs((rB.x - rA.x) * (third.y - rA.y) - (rB.y - rA.y) * (third.x - rA.x)) /
          distance(rA, rB) -
        input.materialThicknessMm;
      const target = edit?.tab.targetDepthMm ?? input.settings.tabDefaultDepthMm,
        angle = edit?.tab.shoulderAngleDeg ?? input.settings.tabShoulderAngleDeg;
      const build = (depth: number): PapercraftTab => ({
        id: `tab-${edge.edgeKey}`,
        edgeKey: edge.edgeKey,
        ownerFaceId: owner.faceId,
        receiverFaceId: receiver.faceId,
        islandId: island.id,
        depthMm: depth,
        shoulderAngleDeg: angle,
        outline: makePapercraftTab(a, b, depth, angle),
        status: 'enabled',
      });
      example = build(Math.min(target, 0.4 * owner.lengthMm, 15));
      if (preference === 'none') {
        example.status = 'suppressed';
        fitted = example;
        issues.push(
          papercraftIssue(
            'PAPERCRAFT_CLOSURE_SUPPRESSED',
            [edge.edgeKey],
            'This seam has no glue closure by explicit preference. Review assembly.',
            'warning',
          ),
        );
        break;
      }
      const faces = result.faces.filter((f) => island.faceIds.includes(f.id)),
        contours = tracePapercraftPerimeter(result.source, faces, result.hingeKeys)!;
      fitted = fitTabToPerimeter(
        target,
        minimumDepthMm,
        Math.min(0.4 * owner.lengthMm, clearance),
        build,
        (tab) =>
          isSimplePolygon(tab.outline) &&
          !faces.some((f) => positivePolygonOverlap(f.points, tab.outline)) &&
          !tabs.some(
            (t) =>
              t.status === 'enabled' &&
              t.islandId === island.id &&
              positivePolygonOverlap(t.outline, tab.outline),
          ) &&
          contoursWithTabs(contours, [...tabs, tab]).every(isSimplePolygon),
      );
      if (fitted) {
        if (fitted.depthMm < target - EPS_LENGTH_MM)
          issues.push(
            papercraftIssue(
              'PAPERCRAFT_TAB_REDUCED',
              [edge.edgeKey, fitted.id],
              `Tab reduced to ${fitted.depthMm} mm for boundary and receiver clearance.`,
              'info',
            ),
          );
        break;
      }
    }
    if (fitted) tabs.push(fitted);
    else if (example) {
      tabs.push({ ...example, status: 'unresolved' });
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_TAB_UNRESOLVED',
          [edge.edgeKey, example.ownerFaceId],
          'No collision-free glue tab meets the physical depth floor. Flip its owner, split the net, reduce stock or explicitly suppress this closure.',
        ),
      );
    }
  }
  return { tabs, issues };
}
