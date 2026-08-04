import type { Point2D, SerializableTriangleMesh, Vector3Mm } from '../../domain/geometry';
import type { SurfaceDevelopment } from '../../domain/surfaceDevelopment';
import { classifySurfacePatch } from './classifySurfacePatch';
import { measureFlattening } from './measureFlattening';

export interface DevelopSurfacePatchOptions {
  maximumEdgeStrainPercent: number;
}

function vertex(mesh: SerializableTriangleMesh, index: number): Vector3Mm {
  return [
    mesh.positionsMm[index * 3]!,
    mesh.positionsMm[index * 3 + 1]!,
    mesh.positionsMm[index * 3 + 2]!,
  ];
}

function axisIndex(axis: Vector3Mm): 0 | 1 | 2 {
  return Math.abs(axis[0]) > 0.5 ? 0 : Math.abs(axis[1]) > 0.5 ? 1 : 2;
}

function transverseAxes(axis: 0 | 1 | 2): [0 | 1 | 2, 0 | 1 | 2] {
  return ([0, 1, 2] as const).filter((index) => index !== axis) as [0 | 1 | 2, 0 | 1 | 2];
}

function circleFromThreePoints(
  a: Point2D,
  b: Point2D,
  c: Point2D,
): { center: Point2D; radius: number } | undefined {
  const determinant = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(determinant) < 1e-9) return undefined;
  const aSquared = a.x * a.x + a.y * a.y;
  const bSquared = b.x * b.x + b.y * b.y;
  const cSquared = c.x * c.x + c.y * c.y;
  const center = {
    x: (aSquared * (b.y - c.y) + bSquared * (c.y - a.y) + cSquared * (a.y - b.y)) / determinant,
    y: (aSquared * (c.x - b.x) + bSquared * (a.x - c.x) + cSquared * (b.x - a.x)) / determinant,
  };
  return { center, radius: Math.hypot(a.x - center.x, a.y - center.y) };
}

function rings(mesh: SerializableTriangleMesh, axis: 0 | 1 | 2) {
  const transverse = transverseAxes(axis);
  const byLevel = new Map<number, { axial: number; points: { index: number; point: Point2D }[] }>();
  for (let index = 0; index < mesh.positionsMm.length / 3; index += 1) {
    const point = vertex(mesh, index);
    const key = Math.round(point[axis] * 1e6);
    const ring = byLevel.get(key) ?? { axial: point[axis], points: [] };
    ring.points.push({ index, point: { x: point[transverse[0]], y: point[transverse[1]] } });
    byLevel.set(key, ring);
  }
  return [...byLevel.values()]
    .map((ring) => {
      const sorted = [...ring.points].sort((a, b) => a.index - b.index);
      const fitted = circleFromThreePoints(
        sorted[0]!.point,
        sorted[Math.floor(sorted.length / 2)]!.point,
        sorted.at(-1)!.point,
      );
      if (!fitted) throw new Error('The revolved patch ring is too narrow to fit a circle.');
      return { ...ring, ...fitted };
    })
    .sort((a, b) => a.axial - b.axial);
}

function unwrapAngles(
  mesh: SerializableTriangleMesh,
  center: Point2D,
  transverse: [0 | 1 | 2, 0 | 1 | 2],
): number[] {
  const raw = Array.from({ length: mesh.positionsMm.length / 3 }, (_, index) => {
    const point = vertex(mesh, index);
    return Math.atan2(point[transverse[1]] - center.y, point[transverse[0]] - center.x);
  });
  const adjacency = Array.from({ length: raw.length }, () => new Set<number>());
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const triangle = mesh.indices.slice(index, index + 3);
    for (let edge = 0; edge < 3; edge += 1) {
      const a = triangle[edge]!;
      const b = triangle[(edge + 1) % 3]!;
      adjacency[a]!.add(b);
      adjacency[b]!.add(a);
    }
  }
  const unwrapped = Array<number | undefined>(raw.length).fill(undefined);
  unwrapped[0] = raw[0]!;
  const queue = [0];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of [...adjacency[current]!].sort((a, b) => a - b)) {
      if (unwrapped[next] !== undefined) continue;
      let delta = raw[next]! - raw[current]!;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      unwrapped[next] = unwrapped[current]! + delta;
      queue.push(next);
    }
  }
  if (unwrapped.some((angle) => angle === undefined))
    throw new Error('The surface patch must be connected.');
  const origin = Math.min(...(unwrapped as number[]));
  return (unwrapped as number[]).map((angle) => angle - origin);
}

function developPlanar(mesh: SerializableTriangleMesh): Point2D[] {
  const points = Array.from({ length: mesh.positionsMm.length / 3 }, (_, index) =>
    vertex(mesh, index),
  );
  const extents = ([0, 1, 2] as const).map(
    (axis) =>
      Math.max(...points.map((point) => point[axis])) -
      Math.min(...points.map((point) => point[axis])),
  );
  const axes = [...([0, 1, 2] as const)]
    .sort((a, b) => (extents.at(b) ?? 0) - (extents.at(a) ?? 0))
    .slice(0, 2);
  const firstAxis = axes[0] ?? 0;
  const secondAxis = axes[1] ?? 1;
  return points.map((point) => ({ x: point[firstAxis], y: point[secondAxis] }));
}

export function developSurfacePatch(
  mesh: SerializableTriangleMesh,
  options: DevelopSurfacePatchOptions,
): SurfaceDevelopment {
  const classification = classifySurfacePatch(mesh);
  if (!['planar', 'cylindrical', 'conical'].includes(classification.kind)) {
    throw new Error(`Surface kind ${classification.kind} has no exact analytic development.`);
  }
  let flattened: Point2D[];
  if (classification.kind === 'planar') {
    flattened = developPlanar(mesh);
  } else {
    const axis = axisIndex(classification.estimatedAxis ?? [0, 0, 1]);
    const transverse = transverseAxes(axis);
    const fittedRings = rings(mesh, axis);
    const center = fittedRings.reduce(
      (sum, ring) => ({
        x: sum.x + ring.center.x / fittedRings.length,
        y: sum.y + ring.center.y / fittedRings.length,
      }),
      { x: 0, y: 0 },
    );
    const angles = unwrapAngles(mesh, center, transverse);
    if (classification.kind === 'cylindrical') {
      const radius = fittedRings.reduce((sum, ring) => sum + ring.radius, 0) / fittedRings.length;
      const minimumAxial = fittedRings[0]!.axial;
      flattened = angles.map((angle, index) => ({
        x: angle * radius,
        y: vertex(mesh, index)[axis] - minimumAxial,
      }));
    } else {
      const low = fittedRings[0]!;
      const high = fittedRings.at(-1)!;
      const slope = (high.radius - low.radius) / (high.axial - low.axial);
      if (Math.abs(slope) < 1e-9)
        throw new Error('Conical development requires a measurable taper.');
      const apexAxial = low.axial - low.radius / slope;
      const sectorScale = Math.abs(slope) / Math.hypot(1, slope);
      flattened = angles.map((angle, index) => {
        const point = vertex(mesh, index);
        const radial = Math.hypot(point[transverse[0]] - center.x, point[transverse[1]] - center.y);
        const slant = Math.hypot(point[axis] - apexAxial, radial);
        const sectorAngle = angle * sectorScale;
        return { x: slant * Math.cos(sectorAngle), y: slant * Math.sin(sectorAngle) };
      });
    }
  }
  const metrics = measureFlattening(mesh, flattened);
  return {
    kind: classification.kind as SurfaceDevelopment['kind'],
    vertices: flattened.map((point, sourceVertexIndex) => ({ sourceVertexIndex, point })),
    metrics,
    withinTolerance:
      metrics.maximumEdgeStrainPercent <= options.maximumEdgeStrainPercent &&
      metrics.flippedTriangleCount === 0,
    algorithmVersion: 'analytic-developable-v1',
  };
}
