import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';
import type { AssembledFoldPanel } from '../../domain/folding';
import type { Vector3Mm } from '../../domain/geometry';
const sub = (a: Vector3Mm, b: Vector3Mm): Vector3Mm => a.map((v, i) => v - b[i]!) as Vector3Mm;
const dot = (a: Vector3Mm, b: Vector3Mm) => a.reduce((s, v, i) => s + v * b[i]!, 0);
const cross = (a: Vector3Mm, b: Vector3Mm): Vector3Mm => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (v: Vector3Mm): Vector3Mm => v.map((n) => n / Math.hypot(...v)) as Vector3Mm;
const clean = (points: Vector3Mm[]) =>
  points.length > 3 && Math.hypot(...sub(points[0]!, points.at(-1)!)) < 1e-6
    ? points.slice(0, -1)
    : points;
/** Renderer-only planar triangulation. Holes and concave boundaries retain the assembled correspondence. */
export function assembledPanelGeometry(panel: AssembledFoldPanel): BufferGeometry {
  const outer = clean(panel.verticesMm),
    holes = (panel.holesVerticesMm ?? []).map(clean),
    origin = outer[0]!;
  const along = outer.find((p) => Math.hypot(...sub(p, origin)) > 1e-6);
  if (!along) throw new Error('Panel has no physical edge.');
  const u = unit(sub(along, origin)),
    third = outer.find((p) => Math.hypot(...cross(u, sub(p, origin))) > 1e-8);
  if (!third) throw new Error('Panel has no physical area.');
  const normal = unit(cross(u, sub(third, origin))),
    v = cross(normal, u);
  const project = (p: Vector3Mm) => {
    const delta = sub(p, origin);
    return new Vector2(dot(delta, u), dot(delta, v));
  };
  const indices = ShapeUtils.triangulateShape(
    outer.map(project),
    holes.map((loop) => loop.map(project)),
  ).flat();
  if (!indices.length) throw new Error('Panel boundary could not be triangulated.');
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([...outer, ...holes.flat()].flat(), 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
