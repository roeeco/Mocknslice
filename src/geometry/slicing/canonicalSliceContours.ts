import type { SerializableTriangleMesh, Point2D, Vector3Mm } from '../../domain/geometry';
import type { SliceAxis } from '../../domain/fabrication';
import { meshVertex, buildMeshTopology } from '../unfolding/meshAdjacency';
import { intersectTriangleWithPlane } from './trianglePlaneIntersection';
import { traceMaterialBoundary } from '../designGraph/booleanPerimeter';
import { signedArea } from '../designGraph/polygons';
import { EPS_LENGTH_MM } from '../designGraph/tolerances';

/** Oriented surface intersections use nonzero winding; coplanar surface patches add material. */
export function canonicalSliceContours(
  mesh: SerializableTriangleMesh,
  axis: SliceAxis,
  position: number,
  epsilon: number,
): Point2D[][] | undefined {
  const topology = buildMeshTopology(mesh);
  if (topology.nonManifoldEdgeCount || topology.orientationIssueCount) return;
  const project = (p: Vector3Mm): Point2D =>
      axis === 'x'
        ? { x: p[2], y: p[1] }
        : axis === 'y'
          ? { x: p[0], y: p[2] }
          : { x: p[0], y: p[1] },
    planeNormal: Vector3Mm = axis === 'x' ? [-1, 0, 0] : axis === 'y' ? [0, -1, 0] : [0, 0, 1];
  const cross3 = (a: Vector3Mm, b: Vector3Mm): Vector3Mm => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    subtract = (a: Vector3Mm, b: Vector3Mm): Vector3Mm => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  let volume = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = meshVertex(mesh, mesh.indices[i]!),
      b = meshVertex(mesh, mesh.indices[i + 1]!),
      c = meshVertex(mesh, mesh.indices[i + 2]!),
      normal = cross3(b, c);
    volume += a[0] * normal[0] + a[1] * normal[1] + a[2] * normal[2];
  }
  const orientation = Math.sign(volume) || 1,
    segments: { a: Point2D; b: Point2D }[] = [],
    coplanar: Point2D[][] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const vertices = [0, 1, 2].map((j) => meshVertex(mesh, mesh.indices[i + j]!)) as [
        Vector3Mm,
        Vector3Mm,
        Vector3Mm,
      ],
      result = intersectTriangleWithPlane(vertices, axis, position, epsilon);
    if (result.coplanar) {
      const points = vertices.map(project);
      if (signedArea(points) < 0) points.reverse();
      coplanar.push(points);
      continue;
    }
    if (!result.segment) continue;
    const normal = cross3(subtract(vertices[1], vertices[0]), subtract(vertices[2], vertices[0])),
      tangent = project(cross3(planeNormal, normal)),
      a = result.segment.start,
      b = result.segment.end;
    segments.push(
      ((b.x - a.x) * tangent.x + (b.y - a.y) * tangent.y) * orientation >= 0
        ? { a, b }
        : { a: b, b: a },
    );
  }
  const edges = [
    ...segments,
    ...coplanar.flatMap((loop) => loop.map((a, i) => ({ a, b: loop[(i + 1) % loop.length]! }))),
  ].filter((s) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) > EPS_LENGTH_MM);
  return traceMaterialBoundary(edges, 'nonzero-winding');
}
