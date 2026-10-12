import type { Point2D } from '../../domain/geometry';
import type { PapercraftFlatFace, PreparedPapercraftSource } from '../../domain/papercraft';
import { EPS_LENGTH_MM } from '../designGraph/tolerances';
import {
  isSimplePolygon,
  pointInPolygon,
  signedArea,
  segmentsIntersect,
} from '../designGraph/polygons';
import { flatEdge, distance } from './edgeGeometry';

export interface PapercraftBoundarySegment {
  halfEdgeId: string;
  edgeKey: string;
  faceId: string;
  a: Point2D;
  b: Point2D;
}
export interface PapercraftContour {
  points: Point2D[];
  segments: PapercraftBoundarySegment[];
  hole: boolean;
}
/** Weld within epsLen without quantizing coordinates; reject ambiguous vertex contacts. */
export function tracePapercraftPerimeter(
  source: PreparedPapercraftSource,
  faces: readonly PapercraftFlatFace[],
  hinges: readonly string[],
): PapercraftContour[] | undefined {
  const byFace = new Map(faces.map((f) => [f.id, f]));
  const boundary: PapercraftBoundarySegment[] = source.halfEdges
    .filter((e) => byFace.has(e.faceId) && !hinges.includes(e.edgeKey))
    .map((e) => {
      const [a, b] = flatEdge(byFace.get(e.faceId)!, e);
      return { halfEdgeId: e.id, edgeKey: e.edgeKey, faceId: e.faceId, a, b };
    });
  const vertices: Point2D[] = [],
    index = (p: Point2D) => {
      const matches = vertices.flatMap((v, i) => (distance(v, p) <= EPS_LENGTH_MM ? [i] : []));
      if (matches.length > 1) return -1;
      if (matches.length) return matches[0]!;
      vertices.push(p);
      return vertices.length - 1;
    };
  const links = boundary.map((segment) => ({
    segment,
    start: index(segment.a),
    end: index(segment.b),
  }));
  if (links.some((e) => e.start < 0 || e.end < 0 || e.start === e.end)) return;
  const successors = new Map<number, (typeof links)[number]>(),
    incoming = new Map<number, number>();
  for (const link of links) {
    if (successors.has(link.start)) return;
    successors.set(link.start, link);
    incoming.set(link.end, (incoming.get(link.end) ?? 0) + 1);
  }
  if (vertices.some((_, i) => !successors.has(i) || incoming.get(i) !== 1)) return;
  const remaining = new Set(links),
    contours: PapercraftContour[] = [];
  while (remaining.size) {
    const seed = [...remaining][0]!,
      segments: PapercraftBoundarySegment[] = [],
      points: Point2D[] = [];
    let current = seed;
    do {
      if (!remaining.delete(current)) return;
      segments.push(current.segment);
      points.push(current.segment.a);
      current = successors.get(current.end)!;
    } while (current !== seed);
    if (!isSimplePolygon(points)) return;
    contours.push({ points, segments, hole: signedArea(points) < 0 });
  }
  const outers = contours.filter((c) => !c.hole);
  if (
    outers.length !== 1 ||
    contours.some((c) => c.hole && !pointInPolygon(c.points[0]!, outers[0]!.points, false))
  )
    return;
  for (let i = 0; i < contours.length; i++)
    for (let j = i + 1; j < contours.length; j++) {
      const a = contours[i]!,
        b = contours[j]!;
      if (a.segments.some((s) => b.segments.some((t) => segmentsIntersect(s.a, s.b, t.a, t.b))))
        return;
      if (
        a.hole &&
        b.hole &&
        (pointInPolygon(a.points[0]!, b.points) || pointInPolygon(b.points[0]!, a.points))
      )
        return;
    }
  return contours.sort((a, b) => Number(a.hole) - Number(b.hole));
}
