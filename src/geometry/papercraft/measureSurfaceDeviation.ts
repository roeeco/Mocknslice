import type { SerializableTriangleMesh, Vector3Mm } from '../../domain/geometry';
import { meshVertex } from '../unfolding/meshAdjacency';
import { convexIntersectionArea } from '../designGraph/polygons';
import { EPS_AREA_MM2, EPS_LENGTH_MM } from '../designGraph/tolerances';
type Triangle = [Vector3Mm, Vector3Mm, Vector3Mm];
const sub = (a: Vector3Mm, b: Vector3Mm): Vector3Mm => a.map((v, i) => v - b[i]!) as Vector3Mm;
const dot = (a: Vector3Mm, b: Vector3Mm) => a.reduce((s, v, i) => s + v * b[i]!, 0);
const cross = (a: Vector3Mm, b: Vector3Mm): Vector3Mm => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const middle = (a: Vector3Mm, b: Vector3Mm): Vector3Mm =>
  a.map((v, i) => (v + b[i]!) / 2) as Vector3Mm;
const distance = (a: Vector3Mm, b: Vector3Mm) => Math.hypot(...sub(a, b));
function pointTriangleDistance(p: Vector3Mm, triangle: Triangle) {
  const [a, b, c] = triangle,
    u = sub(b, a),
    v = sub(c, a),
    n = cross(u, v),
    delta = sub(p, a),
    nn = dot(n, n),
    uu = dot(u, u),
    vv = dot(v, v),
    uv = dot(u, v),
    du = dot(delta, u),
    dv = dot(delta, v),
    denominator = uu * vv - uv * uv;
  const x = (du * vv - dv * uv) / denominator,
    y = (dv * uu - du * uv) / denominator;
  if (denominator > 0 && x >= 0 && y >= 0 && x + y <= 1)
    return Math.abs(dot(delta, n)) / Math.sqrt(nn);
  return Math.min(
    ...triangle.map((start, i) => {
      const end = triangle[(i + 1) % 3]!,
        edge = sub(end, start),
        t = Math.max(0, Math.min(1, dot(sub(p, start), edge) / dot(edge, edge)));
      return distance(p, start.map((value, axis) => value + edge[axis]! * t) as Vector3Mm);
    }),
  );
}
interface Box {
  min: Vector3Mm;
  max: Vector3Mm;
}
interface Node extends Box {
  triangles?: Triangle[];
  left?: Node;
  right?: Node;
}
const boxDistance = (p: Vector3Mm, box: Box) =>
  Math.hypot(...p.map((v, i) => Math.max(box.min[i]! - v, 0, v - box.max[i]!)));
function tree(triangles: Triangle[]): Node {
  const min = [Infinity, Infinity, Infinity] as Vector3Mm,
    max = [-Infinity, -Infinity, -Infinity] as Vector3Mm;
  for (const t of triangles)
    for (const p of t)
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i]!, p[i]!);
        max[i] = Math.max(max[i]!, p[i]!);
      }
  if (triangles.length <= 8) return { min, max, triangles };
  const axis = [0, 1, 2].sort((a, b) => max[b]! - min[b]! - (max[a]! - min[a]!))[0]!;
  const sorted = [...triangles].sort(
      (a, b) => a.reduce((s, p) => s + p[axis]!, 0) - b.reduce((s, p) => s + p[axis]!, 0),
    ),
    mid = Math.floor(sorted.length / 2);
  return { min, max, left: tree(sorted.slice(0, mid)), right: tree(sorted.slice(mid)) };
}
function nearest(point: Vector3Mm, node: Node, best = Infinity): number {
  if (boxDistance(point, node) > best) return best;
  if (node.triangles) {
    for (const t of node.triangles) best = Math.min(best, pointTriangleDistance(point, t));
    return best;
  }
  const children = [node.left!, node.right!].sort(
    (a, b) => boxDistance(point, a) - boxDistance(point, b),
  );
  return nearest(point, children[1]!, nearest(point, children[0]!, best));
}
function candidates(box: Box, node: Node): Triangle[] {
  if (
    box.min.some(
      (v, i) => v > node.max[i]! + EPS_LENGTH_MM || box.max[i]! < node.min[i]! - EPS_LENGTH_MM,
    )
  )
    return [];
  return node.triangles ?? [...candidates(box, node.left!), ...candidates(box, node.right!)];
}
function coveredCoplanar(triangle: Triangle, target: Node) {
  const [a, b, c] = triangle,
    normal = cross(sub(b, a), sub(c, a)),
    length = Math.hypot(...normal),
    axis = [0, 1, 2].sort((i, j) => Math.abs(normal[j]!) - Math.abs(normal[i]!))[0]!,
    axes = [0, 1, 2].filter((i) => i !== axis);
  const project = (p: Vector3Mm) => ({ x: p[axes[0]!]!, y: p[axes[1]!]! }),
    points = triangle.map(project);
  const area =
    Math.abs(
      (points[1]!.x - points[0]!.x) * (points[2]!.y - points[0]!.y) -
        (points[1]!.y - points[0]!.y) * (points[2]!.x - points[0]!.x),
    ) / 2;
  const box = {
    min: [0, 1, 2].map((i) => Math.min(...triangle.map((p) => p[i]!))) as Vector3Mm,
    max: [0, 1, 2].map((i) => Math.max(...triangle.map((p) => p[i]!))) as Vector3Mm,
  };
  let covered = 0;
  for (const other of candidates(box, target)) {
    if (other.some((p) => Math.abs(dot(sub(p, a), normal)) / length > 1e-9)) continue;
    covered += convexIntersectionArea(points, other.map(project));
  }
  return covered >= area - EPS_AREA_MM2;
}
/** Bidirectional continuous surface bound, using the 1-Lipschitz distance to a triangle union. */
export function verifySurfaceDeviation(
  source: SerializableTriangleMesh,
  working: SerializableTriangleMesh,
  limitMm: number,
  maxQueries = 200000,
): { maximumDeviationMm: number; verified: boolean; queries: number } {
  const triangles = (mesh: SerializableTriangleMesh): Triangle[] =>
    Array.from(
      { length: mesh.indices.length / 3 },
      (_, i) => mesh.indices.slice(i * 3, i * 3 + 3).map((v) => meshVertex(mesh, v)) as Triangle,
    );
  const a = triangles(source),
    b = triangles(working),
    ta = tree(a),
    tb = tree(b);
  let maximum = 0,
    queries = 0;
  const verify = (triangle: Triangle, target: Node, depth = 0): boolean => {
    if (coveredCoplanar(triangle, target)) return true;
    const [x, y, z] = triangle,
      xy = middle(x, y),
      yz = middle(y, z),
      zx = middle(z, x),
      centre = x.map((v, i) => (v + y[i]! + z[i]!) / 3) as Vector3Mm;
    let upper = Infinity;
    for (const p of [x, y, z, xy, yz, zx, centre]) {
      if (++queries > maxQueries) return false;
      const d = nearest(p, target);
      if (d > limitMm + 1e-9) return false;
      upper = Math.min(upper, d + Math.max(...triangle.map((v) => distance(p, v))));
    }
    if (upper <= limitMm) {
      maximum = Math.max(maximum, upper);
      return true;
    }
    if (depth >= 10) return false;
    return [
      [x, xy, zx],
      [xy, y, yz],
      [zx, yz, z],
      [xy, yz, zx],
    ].every((child) => verify(child as Triangle, target, depth + 1));
  };
  const verified = a.every((t) => verify(t, tb)) && b.every((t) => verify(t, ta));
  return { maximumDeviationMm: verified ? maximum : Infinity, verified, queries };
}
