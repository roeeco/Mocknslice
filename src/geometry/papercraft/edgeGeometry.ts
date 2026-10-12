import type { Point2D } from '../../domain/geometry';
import type {
  PapercraftFlatFace,
  PapercraftHalfEdge,
  PreparedPapercraftSource,
} from '../../domain/papercraft';
import { meshVertex } from '../unfolding/meshAdjacency';
import { EPS_LENGTH_MM, edgeMatchToleranceMm } from '../designGraph/tolerances';

export const distance = (a: Point2D, b: Point2D) => Math.hypot(b.x - a.x, b.y - a.y);
export function flattenFaces(source: PreparedPapercraftSource): PapercraftFlatFace[] {
  return source.faces.map((face) => {
    const [a, b, c] = face.vertexIds.map((i) => meshVertex(source.mesh, i));
    const ab = b!.map((v, i) => v - a![i]!),
      ac = c!.map((v, i) => v - a![i]!);
    const length = Math.hypot(...ab),
      x = ac.reduce((s, v, i) => s + v * ab[i]!, 0) / length;
    const y = Math.sqrt(Math.max(0, ac.reduce((s, v) => s + v * v, 0) - x * x));
    return {
      id: face.id,
      sourceFaceIndex: face.index,
      vertexIds: face.vertexIds,
      points: [
        { x: 0, y: 0 },
        { x: length, y: 0 },
        { x, y },
      ],
    };
  });
}
export function flatEdge(face: PapercraftFlatFace, edge: PapercraftHalfEdge): [Point2D, Point2D] {
  return [
    face.points[face.vertexIds.indexOf(edge.startVertex)]!,
    face.points[face.vertexIds.indexOf(edge.endVertex)]!,
  ];
}
export function rigidEdgeMap(
  child: [Point2D, Point2D],
  parent: [Point2D, Point2D],
  lengthMm: number,
): ((p: Point2D) => Point2D) | undefined {
  const [a, b] = child,
    [targetB, targetA] = parent;
  if (
    Math.abs(distance(a, b) - lengthMm) > edgeMatchToleranceMm(lengthMm) ||
    Math.abs(distance(targetA, targetB) - lengthMm) > edgeMatchToleranceMm(lengthMm) ||
    lengthMm <= EPS_LENGTH_MM
  )
    return;
  const angle =
      Math.atan2(targetB.y - targetA.y, targetB.x - targetA.x) - Math.atan2(b.y - a.y, b.x - a.x),
    c = Math.cos(angle),
    s = Math.sin(angle);
  return (p) => ({
    x: targetA.x + c * (p.x - a.x) - s * (p.y - a.y),
    y: targetA.y + s * (p.x - a.x) + c * (p.y - a.y),
  });
}
