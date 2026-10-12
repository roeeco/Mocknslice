import type { PapercraftResult } from '../../domain/papercraft';
import type { Vector3Mm } from '../../domain/geometry';
import {
  unfoldedFaceVerticesAtProgress,
  type UnfoldedFaceVertices,
} from '../unfolding/foldPreview';
import { poseFromCorrespondence } from '../designGraph/poses';
import { meshVertex } from '../unfolding/meshAdjacency';
type Quaternion = [number, number, number, number];
function quaternion(m: number[]): Quaternion {
  const trace = m[0]! + m[5]! + m[10]!;
  let q: Quaternion;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    q = [(m[6]! - m[9]!) / s, (m[8]! - m[2]!) / s, (m[1]! - m[4]!) / s, s / 4];
  } else if (m[0]! > m[5]! && m[0]! > m[10]!) {
    const s = Math.sqrt(1 + m[0]! - m[5]! - m[10]!) * 2;
    q = [s / 4, (m[4]! + m[1]!) / s, (m[8]! + m[2]!) / s, (m[6]! - m[9]!) / s];
  } else if (m[5]! > m[10]!) {
    const s = Math.sqrt(1 + m[5]! - m[0]! - m[10]!) * 2;
    q = [(m[4]! + m[1]!) / s, s / 4, (m[9]! + m[6]!) / s, (m[8]! - m[2]!) / s];
  } else {
    const s = Math.sqrt(1 + m[10]! - m[0]! - m[5]!) * 2;
    q = [(m[8]! + m[2]!) / s, (m[9]! + m[6]!) / s, s / 4, (m[1]! - m[4]!) / s];
  }
  const length = Math.hypot(...q);
  return q.map((v) => v / length) as Quaternion;
}
function slerp(a: Quaternion, b: Quaternion, progress: number): Quaternion {
  let dot = a.reduce((sum, v, i) => sum + v * b[i]!, 0);
  if (dot < 0) {
    b = b.map((v) => -v) as Quaternion;
    dot = -dot;
  }
  if (dot > 0.9995) {
    const q = a.map((v, i) => v + progress * (b[i]! - v)),
      length = Math.hypot(...q);
    return q.map((v) => v / length) as Quaternion;
  }
  const theta = Math.acos(Math.min(1, dot)),
    sin = Math.sin(theta);
  return a.map(
    (v, i) => (v * Math.sin((1 - progress) * theta) + b[i]! * Math.sin(progress * theta)) / sin,
  ) as Quaternion;
}
function rotate(p: Vector3Mm, q: Quaternion): Vector3Mm {
  const [x, y, z, w] = q,
    [px, py, pz] = p;
  const tx = 2 * (y * pz - z * py),
    ty = 2 * (z * px - x * pz),
    tz = 2 * (x * py - y * px);
  return [
    px + w * tx + y * tz - z * ty,
    py + w * ty + z * tx - x * tz,
    pz + w * tz + x * ty - y * tx,
  ];
}
/** Separate flat islands converge to their actual source orientation and body spacing. */
export function papercraftFaceVerticesAtProgress(
  result: PapercraftResult,
  progress: number,
): UnfoldedFaceVertices {
  const t = Math.max(0, Math.min(1, progress)),
    positions = unfoldedFaceVerticesAtProgress(result.unfolding, t),
    mesh = result.source.mesh;
  const minima = [Infinity, Infinity, Infinity],
    maxima = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positionsMm.length; i++) {
    const axis = i % 3,
      value = mesh.positionsMm[i]!;
    minima[axis] = Math.min(minima[axis]!, value);
    maxima[axis] = Math.max(maxima[axis]!, value);
  }
  const sourceCentre = minima.map((v, i) => (v + maxima[i]!) / 2);
  const packs = result.islands.map((island) => {
    const points = result.faces
      .filter((f) => island.faceIds.includes(f.id))
      .flatMap((f) => f.points);
    const minX = Math.min(...points.map((p) => p.x)),
      maxX = Math.max(...points.map((p) => p.x)),
      minY = Math.min(...points.map((p) => p.y)),
      maxY = Math.max(...points.map((p) => p.y));
    return { island, minX, minY, width: maxX - minX, height: maxY - minY };
  });
  const totalWidth = packs.reduce((sum, p) => sum + p.width + 10, -10);
  let cursor = -totalWidth / 2;
  for (const pack of packs) {
    const root = result.faces.find((f) => f.id === pack.island.rootFaceId)!;
    const world = root.vertexIds.map(
      (id) => meshVertex(mesh, id).map((v, i) => v - sourceCentre[i]!) as Vector3Mm,
    );
    const pose = poseFromCorrespondence(root.points, world)!;
    const q = slerp([-Math.SQRT1_2, 0, 0, Math.SQRT1_2], quaternion(pose), t);
    const flatTranslation = [cursor - pack.minX, 0, pack.minY + pack.height / 2];
    const translation = flatTranslation.map((v, i) => v * (1 - t) + pose[i + 12]! * t);
    for (const faceId of pack.island.faceIds) {
      const vertices = positions.get(faceId)!;
      positions.set(
        faceId,
        vertices.map((p) => rotate(p, q).map((v, i) => v + translation[i]!) as Vector3Mm) as [
          Vector3Mm,
          Vector3Mm,
          Vector3Mm,
        ],
      );
    }
    cursor += pack.width + 10;
  }
  return positions;
}
