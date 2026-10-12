import type { Point2D, Vector3Mm } from '../../domain/geometry';
import { cross } from './polygons';
import { EPS_AREA_MM2 } from './tolerances';

const subtract = (a: Vector3Mm, b: Vector3Mm): Vector3Mm => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vector3Mm, b: Vector3Mm) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vector3Mm): Vector3Mm => {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** Recover a rigid pose from corresponding outline vertices, never a renderer object. */
export function poseFromCorrespondence(
  flat: readonly Point2D[],
  world: readonly Vector3Mm[],
): number[] | undefined {
  if (flat.length !== world.length || flat.length < 3) return undefined;
  const origin = flat[0]!,
    target = world[0]!;
  const end = flat[1]!;
  const length = Math.hypot(end.x - origin.x, end.y - origin.y);
  const third = flat.findIndex((p, i) => i > 1 && Math.abs(cross(origin, end, p)) > EPS_AREA_MM2);
  if (third < 0 || length === 0) return undefined;
  const ux = (end.x - origin.x) / length,
    uy = (end.y - origin.y) / length;
  const u = norm(subtract(world[1]!, target));
  const delta = subtract(world[third]!, target),
    along = dot(delta, u);
  let v = norm([delta[0] - u[0] * along, delta[1] - u[1] * along, delta[2] - u[2] * along]);
  if (cross(origin, end, flat[third]!) < 0) v = [-v[0], -v[1], -v[2]];
  const x: Vector3Mm = [u[0] * ux - v[0] * uy, u[1] * ux - v[1] * uy, u[2] * ux - v[2] * uy];
  const y: Vector3Mm = [u[0] * uy + v[0] * ux, u[1] * uy + v[1] * ux, u[2] * uy + v[2] * ux];
  const z: Vector3Mm = [
    x[1] * y[2] - x[2] * y[1],
    x[2] * y[0] - x[0] * y[2],
    x[0] * y[1] - x[1] * y[0],
  ];
  const t = target.map((value, i) => value - x[i]! * origin.x - y[i]! * origin.y);
  return [...x, 0, ...y, 0, ...z, 0, ...t, 1];
}

export function applyPose(point: Point2D, pose: readonly number[]): Vector3Mm {
  return [0, 1, 2].map(
    (i) => Math.round((pose[i]! * point.x + pose[i + 4]! * point.y + pose[i + 12]!) * 1e6) / 1e6,
  ) as Vector3Mm;
}

export interface PoseConstraint {
  flatStart: Point2D;
  flatEnd: Point2D;
  worldStart: Vector3Mm;
  worldEnd: Vector3Mm;
}

export function recoverPanelPose(
  flat: readonly Point2D[],
  world: readonly Vector3Mm[],
  constraints: readonly PoseConstraint[] = [],
) {
  const distance = (a: Vector3Mm, b: Vector3Mm) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const count = flat.length;
  for (const reverse of [false, true])
    for (let offset = 0; offset < count; offset++) {
      const order = flat.map((_, i) => (offset + (reverse ? -i : i) + count) % count);
      const correspondence = order.map((i) => world[i]!);
      const pose = poseFromCorrespondence(flat, correspondence);
      if (!pose || pose.some((value) => !Number.isFinite(value))) continue;
      if (flat.some((point, i) => distance(applyPose(point, pose), correspondence[i]!) > 1e-5))
        continue;
      if (
        constraints.some((c) => {
          const a = applyPose(c.flatStart, pose),
            b = applyPose(c.flatEnd, pose);
          return (
            Math.min(
              distance(a, c.worldStart) + distance(b, c.worldEnd),
              distance(a, c.worldEnd) + distance(b, c.worldStart),
            ) > 1e-5
          );
        })
      )
        continue;
      return { pose, order };
    }
  return undefined;
}
