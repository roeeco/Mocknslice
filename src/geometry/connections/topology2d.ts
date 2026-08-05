import type { Point2D } from '../../domain/geometry';

export interface RigidTransform2D {
  cos: number;
  sin: number;
  tx: number;
  ty: number;
}

export interface TopologyPanel {
  id: string;
  outline: Point2D[];
}

export interface TopologyConnection {
  id: string;
  panelAId: string;
  panelBId: string;
  edgeA: { start: Point2D; end: Point2D };
  edgeB: { start: Point2D; end: Point2D };
}

export interface TopologyLayout {
  components: string[][];
  transforms: Map<string, RigidTransform2D>;
  cycleConnectionIds: string[];
}

const IDENTITY: RigidTransform2D = { cos: 1, sin: 0, tx: 0, ty: 0 };

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function transformPoint(point: Point2D, transform: RigidTransform2D): Point2D {
  return {
    x: rounded(point.x * transform.cos - point.y * transform.sin + transform.tx),
    y: rounded(point.x * transform.sin + point.y * transform.cos + transform.ty),
  };
}

function alignmentTransform(
  sourceStart: Point2D,
  sourceEnd: Point2D,
  targetStart: Point2D,
  targetEnd: Point2D,
): RigidTransform2D {
  const sourceAngle = Math.atan2(sourceEnd.y - sourceStart.y, sourceEnd.x - sourceStart.x);
  const targetAngle = Math.atan2(targetEnd.y - targetStart.y, targetEnd.x - targetStart.x);
  const angle = targetAngle - sourceAngle;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    cos,
    sin,
    tx: targetStart.x - (sourceStart.x * cos - sourceStart.y * sin),
    ty: targetStart.y - (sourceStart.x * sin + sourceStart.y * cos),
  };
}

export function layoutCreaseComponents(
  panels: readonly TopologyPanel[],
  connections: readonly TopologyConnection[],
): TopologyLayout {
  const panelIds = new Set(panels.map((panel) => panel.id));
  const parent = new Map([...panelIds].map((id) => [id, id]));
  const find = (id: string): string => {
    const current = parent.get(id)!;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const cycleConnectionIds: string[] = [];
  for (const connection of connections) {
    if (!panelIds.has(connection.panelAId) || !panelIds.has(connection.panelBId)) continue;
    const rootA = find(connection.panelAId);
    const rootB = find(connection.panelBId);
    if (rootA === rootB) cycleConnectionIds.push(connection.id);
    else parent.set(rootB, rootA);
  }

  const adjacency = new Map<string, Array<{ connection: TopologyConnection; fromA: boolean }>>(
    [...panelIds].map((id) => [id, []]),
  );
  for (const connection of connections) {
    adjacency.get(connection.panelAId)?.push({ connection, fromA: true });
    adjacency.get(connection.panelBId)?.push({ connection, fromA: false });
  }

  const transforms = new Map<string, RigidTransform2D>();
  const components: string[][] = [];
  for (const rootId of [...panelIds].sort()) {
    if (transforms.has(rootId)) continue;
    transforms.set(rootId, IDENTITY);
    const component: string[] = [];
    const queue = [rootId];
    while (queue.length > 0) {
      const panelId = queue.shift()!;
      component.push(panelId);
      const current = transforms.get(panelId)!;
      for (const entry of adjacency.get(panelId) ?? []) {
        const { connection, fromA } = entry;
        const nextId = fromA ? connection.panelBId : connection.panelAId;
        if (transforms.has(nextId)) continue;
        const currentEdge = fromA ? connection.edgeA : connection.edgeB;
        const nextEdge = fromA ? connection.edgeB : connection.edgeA;
        const targetStart = transformPoint(currentEdge.end, current);
        const targetEnd = transformPoint(currentEdge.start, current);
        transforms.set(
          nextId,
          alignmentTransform(nextEdge.start, nextEdge.end, targetStart, targetEnd),
        );
        queue.push(nextId);
      }
    }
    components.push(component.sort());
  }
  return { components, transforms, cycleConnectionIds };
}

function pointKey(point: Point2D): string {
  return `${rounded(point.x)},${rounded(point.y)}`;
}

export function sameSegment(
  firstStart: Point2D,
  firstEnd: Point2D,
  secondStart: Point2D,
  secondEnd: Point2D,
): boolean {
  return (
    (pointKey(firstStart) === pointKey(secondStart) &&
      pointKey(firstEnd) === pointKey(secondEnd)) ||
    (pointKey(firstStart) === pointKey(secondEnd) && pointKey(firstEnd) === pointKey(secondStart))
  );
}

export interface BoundarySegment {
  start: Point2D;
  end: Point2D;
  panelId: string;
  edgeId?: string;
  tabId?: string;
}

export function traceClosedContours(segments: readonly BoundarySegment[]): Point2D[][] {
  const unused = new Set(segments.map((_, index) => index));
  const byPoint = new Map<string, number[]>();
  segments.forEach((segment, index) => {
    for (const point of [segment.start, segment.end]) {
      const key = pointKey(point);
      byPoint.set(key, [...(byPoint.get(key) ?? []), index]);
    }
  });
  const contours: Point2D[][] = [];
  while (unused.size > 0) {
    const firstIndex = unused.values().next().value as number;
    const first = segments[firstIndex]!;
    unused.delete(firstIndex);
    const contour = [first.start, first.end];
    let cursor = first.end;
    while (pointKey(cursor) !== pointKey(contour[0]!) && contour.length <= segments.length + 2) {
      const nextIndex = (byPoint.get(pointKey(cursor)) ?? []).find((index) => unused.has(index));
      if (nextIndex === undefined) break;
      unused.delete(nextIndex);
      const next = segments[nextIndex]!;
      cursor = pointKey(next.start) === pointKey(cursor) ? next.end : next.start;
      contour.push(cursor);
    }
    if (contour.length > 3 && pointKey(contour.at(-1)!) === pointKey(contour[0]!)) {
      contour.pop();
      contours.push(contour);
    }
  }
  return contours;
}

export function glueTabOutline(start: Point2D, end: Point2D, depthMm: number): Point2D[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const unit = { x: dx / length, y: dy / length };
  const outward = { x: unit.y, y: -unit.x };
  const shoulder = Math.min(length * 0.2, depthMm * 0.35);
  return [
    start,
    {
      x: start.x + unit.x * shoulder + outward.x * depthMm,
      y: start.y + unit.y * shoulder + outward.y * depthMm,
    },
    {
      x: end.x - unit.x * shoulder + outward.x * depthMm,
      y: end.y - unit.y * shoulder + outward.y * depthMm,
    },
    end,
  ].map((point) => ({ x: rounded(point.x), y: rounded(point.y) }));
}

function projection(points: readonly Point2D[], axis: Point2D): { min: number; max: number } {
  const values = points.map((point) => point.x * axis.x + point.y * axis.y);
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function polygonsOverlap(first: readonly Point2D[], second: readonly Point2D[]): boolean {
  const axes = [first, second].flatMap((polygon) =>
    polygon.map((start, index) => {
      const end = polygon[(index + 1) % polygon.length]!;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      return { x: -dy / length, y: dx / length };
    }),
  );
  return axes.every((axis) => {
    const a = projection(first, axis);
    const b = projection(second, axis);
    return Math.min(a.max, b.max) - Math.max(a.min, b.min) > 1e-5;
  });
}
