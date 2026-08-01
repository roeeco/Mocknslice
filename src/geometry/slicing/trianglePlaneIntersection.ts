import type { Point2D, SerializableTriangleMesh } from '../../domain/geometry';
import type { SliceAxis } from '../../domain/fabrication';
import type { SliceSegment } from './types';

const axisIndex: Record<SliceAxis, number> = { x: 0, y: 1, z: 2 };

function project(point: [number, number, number], axis: SliceAxis): Point2D {
  if (axis === 'x') return { x: point[2], y: point[1] };
  if (axis === 'y') return { x: point[0], y: point[2] };
  return { x: point[0], y: point[1] };
}

function distanceSquared(a: Point2D, b: Point2D): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

export interface TriangleIntersectionResult {
  segment?: SliceSegment;
  coplanar: boolean;
}

export function intersectTriangleWithPlane(
  vertices: [[number, number, number], [number, number, number], [number, number, number]],
  axis: SliceAxis,
  positionMm: number,
  epsilonMm: number,
): TriangleIntersectionResult {
  const coordinate = axisIndex[axis];
  const distances = vertices.map((vertex) => (vertex[coordinate] ?? 0) - positionMm);
  const onPlane = distances.map((distance) => Math.abs(distance) <= epsilonMm);
  if (onPlane.every(Boolean)) return { coplanar: true };
  if (
    distances.every((distance) => distance > epsilonMm) ||
    distances.every((distance) => distance < -epsilonMm)
  ) {
    return { coplanar: false };
  }

  const points: Point2D[] = [];
  const addPoint = (point: Point2D) => {
    if (!points.some((candidate) => distanceSquared(candidate, point) <= epsilonMm ** 2))
      points.push(point);
  };
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 0],
  ];
  for (const [startIndex, endIndex] of edges) {
    const start = vertices[startIndex];
    const end = vertices[endIndex];
    const startDistance = distances[startIndex];
    const endDistance = distances[endIndex];
    if (!start || !end || startDistance === undefined || endDistance === undefined) continue;
    if (Math.abs(startDistance) <= epsilonMm) addPoint(project(start, axis));
    if (startDistance * endDistance < -(epsilonMm ** 2)) {
      const ratio = startDistance / (startDistance - endDistance);
      addPoint(
        project(
          [
            start[0] + (end[0] - start[0]) * ratio,
            start[1] + (end[1] - start[1]) * ratio,
            start[2] + (end[2] - start[2]) * ratio,
          ],
          axis,
        ),
      );
    }
  }
  if (points.length !== 2 || distanceSquared(points[0]!, points[1]!) <= epsilonMm ** 2) {
    return { coplanar: false };
  }
  return { coplanar: false, segment: { start: points[0]!, end: points[1]! } };
}

export function intersectMeshWithPlane(
  mesh: SerializableTriangleMesh,
  axis: SliceAxis,
  positionMm: number,
  epsilonMm: number,
): { segments: SliceSegment[]; coplanarTriangleCount: number } {
  const segments: SliceSegment[] = [];
  let coplanarTriangleCount = 0;
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const triangle = [0, 1, 2].map((corner) => {
      const vertexIndex = mesh.indices[offset + corner] ?? 0;
      return [
        mesh.positionsMm[vertexIndex * 3] ?? 0,
        mesh.positionsMm[vertexIndex * 3 + 1] ?? 0,
        mesh.positionsMm[vertexIndex * 3 + 2] ?? 0,
      ] as [number, number, number];
    }) as [[number, number, number], [number, number, number], [number, number, number]];
    const result = intersectTriangleWithPlane(triangle, axis, positionMm, epsilonMm);
    if (result.coplanar) coplanarTriangleCount += 1;
    if (result.segment) segments.push(result.segment);
  }
  return { segments, coplanarTriangleCount };
}
