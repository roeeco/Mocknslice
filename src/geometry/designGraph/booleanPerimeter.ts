import type { Point2D } from '../../domain/geometry';
import { EPS_LENGTH_MM, EPS_AREA_MM2 } from './tolerances';
import { isSimplePolygon, pointInPolygon, pointOnSegment, signedArea, cross } from './polygons';
interface Segment {
  a: Point2D;
  b: Point2D;
  cuts: number[];
}
/** Original planar arrangement boundary for (union additions) minus (union removals). */
export function booleanPerimeter(
  additions: readonly (readonly Point2D[])[],
  removals: readonly (readonly Point2D[])[] = [],
): Point2D[][] | undefined {
  if (!additions.length || [...additions, ...removals].some((p) => !isSimplePolygon(p))) return;
  const edges = [...additions, ...removals].flatMap((loop) =>
    loop.map((a, i) => ({ a, b: loop[(i + 1) % loop.length]! })),
  );
  const inside = (p: Point2D) =>
    additions.some((loop) => pointInPolygon(p, loop, false)) &&
    !removals.some((loop) => pointInPolygon(p, loop, false));
  return traceMaterialBoundary(edges, inside);
}

export function traceMaterialBoundary(
  input: readonly { a: Point2D; b: Point2D }[],
  classifier: ((point: Point2D) => boolean) | 'nonzero-winding',
): Point2D[][] | undefined {
  const segments: Segment[] = input.map((segment) => ({ ...segment, cuts: [0, 1] }));
  if (segments.length > 4000) return;
  const along = (p: Point2D, s: Segment) =>
    ((p.x - s.a.x) * (s.b.x - s.a.x) + (p.y - s.a.y) * (s.b.y - s.a.y)) /
    ((s.b.x - s.a.x) ** 2 + (s.b.y - s.a.y) ** 2);
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i]!,
        b = segments[j]!;
      if (
        Math.min(a.a.x, a.b.x) > Math.max(b.a.x, b.b.x) + EPS_LENGTH_MM ||
        Math.min(b.a.x, b.b.x) > Math.max(a.a.x, a.b.x) + EPS_LENGTH_MM ||
        Math.min(a.a.y, a.b.y) > Math.max(b.a.y, b.b.y) + EPS_LENGTH_MM ||
        Math.min(b.a.y, b.b.y) > Math.max(a.a.y, a.b.y) + EPS_LENGTH_MM
      )
        continue;
      const ax = a.b.x - a.a.x,
        ay = a.b.y - a.a.y,
        bx = b.b.x - b.a.x,
        by = b.b.y - b.a.y,
        denominator = ax * by - ay * bx,
        dx = b.a.x - a.a.x,
        dy = b.a.y - a.a.y;
      if (
        Math.abs(denominator) >
        Number.EPSILON * Math.max(1, Math.hypot(ax, ay) * Math.hypot(bx, by))
      ) {
        const t = (dx * by - dy * bx) / denominator,
          u = (dx * ay - dy * ax) / denominator;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
          a.cuts.push(t);
          b.cuts.push(u);
        }
      } else if (
        Math.abs(cross(a.a, a.b, b.a)) <= EPS_AREA_MM2 &&
        Math.abs(cross(a.a, a.b, b.b)) <= EPS_AREA_MM2
      ) {
        for (const p of [b.a, b.b])
          if (pointOnSegment(p, a.a, a.b)) a.cuts.push(Math.max(0, Math.min(1, along(p, a))));
        for (const p of [a.a, a.b])
          if (pointOnSegment(p, b.a, b.b)) b.cuts.push(Math.max(0, Math.min(1, along(p, b))));
      }
    }
  const vertices: Point2D[] = [],
    buckets = new Map<string, number[]>();
  const index = (p: Point2D) => {
    const x = Math.floor(p.x / EPS_LENGTH_MM),
      y = Math.floor(p.y / EPS_LENGTH_MM);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const i of buckets.get(`${x + dx},${y + dy}`) ?? [])
          if (Math.hypot(p.x - vertices[i]!.x, p.y - vertices[i]!.y) <= EPS_LENGTH_MM) return i;
    const id = vertices.length,
      key = `${x},${y}`;
    vertices.push(p);
    buckets.set(key, [...(buckets.get(key) ?? []), id]);
    return id;
  };
  const atomic = new Map<string, [number, number]>();
  for (const segment of segments) {
    const cuts = [...new Set(segment.cuts)].sort((a, b) => a - b),
      point = (t: number) => ({
        x: segment.a.x + (segment.b.x - segment.a.x) * t,
        y: segment.a.y + (segment.b.y - segment.a.y) * t,
      });
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = point(cuts[i]!),
        b = point(cuts[i + 1]!);
      if (Math.hypot(b.x - a.x, b.y - a.y) <= EPS_LENGTH_MM) continue;
      const ia = index(a),
        ib = index(b);
      if (ia !== ib) atomic.set(`${ia}:${ib}`, [ia, ib]);
    }
  }
  const windingEdges = [...atomic.values()].filter(([a, b]) => !atomic.has(`${b}:${a}`));
  const inside =
    typeof classifier === 'function'
      ? classifier
      : (p: Point2D) => {
          let winding = 0;
          for (const [ia, ib] of windingEdges) {
            const a = vertices[ia]!,
              b = vertices[ib]!;
            if (a.y <= p.y && b.y > p.y && cross(a, b, p) > 0) winding++;
            if (a.y > p.y && b.y <= p.y && cross(a, b, p) < 0) winding--;
          }
          return winding !== 0;
        };
  const edges = new Map<string, [number, number]>();
  for (const [ia, ib] of atomic.values()) {
    const a = vertices[ia]!,
      b = vertices[ib]!,
      length = Math.hypot(b.x - a.x, b.y - a.y),
      probe = Math.min(EPS_LENGTH_MM * 8, length / 16);
    if (probe <= EPS_LENGTH_MM) return;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      nx = -(b.y - a.y) / length,
      ny = (b.x - a.x) / length,
      left = inside({ x: mid.x + nx * probe, y: mid.y + ny * probe }),
      right = inside({ x: mid.x - nx * probe, y: mid.y - ny * probe });
    if (left === right) continue;
    const first = left ? ia : ib,
      last = left ? ib : ia;
    edges.set(`${first}:${last}`, [first, last]);
  }
  const next = new Map<number, number>(),
    incoming = new Map<number, number>();
  for (const [a, b] of edges.values()) {
    if (next.has(a) && next.get(a) !== b) return;
    next.set(a, b);
    incoming.set(b, (incoming.get(b) ?? 0) + 1);
  }
  if ([...next.keys()].some((id) => incoming.get(id) !== 1)) return;
  const remaining = new Set(next.keys()),
    loops: Point2D[][] = [];
  while (remaining.size) {
    const start = [...remaining][0]!,
      loop: Point2D[] = [];
    let current = start;
    do {
      if (!remaining.delete(current)) return;
      loop.push(vertices[current]!);
      const successor = next.get(current);
      if (successor === undefined) return;
      current = successor;
    } while (current !== start);
    if (!isSimplePolygon(loop)) return;
    loops.push(loop);
  }
  return loops.sort((a, b) => Number(signedArea(a) < 0) - Number(signedArea(b) < 0));
}
