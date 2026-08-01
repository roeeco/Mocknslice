import type { Vector3Mm } from '../../domain/geometry';
import type { MeshUnfoldResult } from '../../domain/unfolding';

export type UnfoldedFaceVertices = Map<string, [Vector3Mm, Vector3Mm, Vector3Mm]>;

function subtract(first: Vector3Mm, second: Vector3Mm): Vector3Mm {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

function add(first: Vector3Mm, second: Vector3Mm): Vector3Mm {
  return [first[0] + second[0], first[1] + second[1], first[2] + second[2]];
}

function scale(vector: Vector3Mm, amount: number): Vector3Mm {
  return [vector[0] * amount, vector[1] * amount, vector[2] * amount];
}

function cross(first: Vector3Mm, second: Vector3Mm): Vector3Mm {
  return [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0],
  ];
}

function dot(first: Vector3Mm, second: Vector3Mm): number {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

function rotateAroundAxis(
  point: Vector3Mm,
  axisStart: Vector3Mm,
  axisEnd: Vector3Mm,
  angleRadians: number,
): Vector3Mm {
  const rawAxis = subtract(axisEnd, axisStart);
  const length = Math.hypot(...rawAxis);
  if (length <= 1e-9 || Math.abs(angleRadians) <= 1e-12) return [...point];
  const axis = scale(rawAxis, 1 / length);
  const translated = subtract(point, axisStart);
  const cosine = Math.cos(angleRadians);
  const sine = Math.sin(angleRadians);
  return add(
    axisStart,
    add(
      add(scale(translated, cosine), scale(cross(axis, translated), sine)),
      scale(axis, dot(axis, translated) * (1 - cosine)),
    ),
  );
}

function descendantsByHinge(result: MeshUnfoldResult): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const hinge of result.hinges) {
    const list = children.get(hinge.parentFaceId) ?? [];
    list.push(hinge.childFaceId);
    children.set(hinge.parentFaceId, list);
  }
  const descendants = new Map<string, string[]>();
  const collect = (faceId: string): string[] => {
    const cached = descendants.get(faceId);
    if (cached) return cached;
    const resultIds = [faceId];
    for (const childId of children.get(faceId) ?? []) resultIds.push(...collect(childId));
    descendants.set(faceId, resultIds);
    return resultIds;
  };
  for (const face of result.faces) collect(face.id);
  return descendants;
}

function pointForSourceVertex(
  result: MeshUnfoldResult,
  positions: UnfoldedFaceVertices,
  faceId: string,
  sourceVertex: number,
): Vector3Mm | undefined {
  const face = result.faces.find((candidate) => candidate.id === faceId);
  const facePositions = positions.get(faceId);
  if (!face || !facePositions) return undefined;
  const localIndex = face.sourceVertexIndices.indexOf(sourceVertex);
  return localIndex >= 0 ? facePositions[localIndex] : undefined;
}

export function unfoldedFaceVerticesAtProgress(
  result: MeshUnfoldResult,
  progress: number,
): UnfoldedFaceVertices {
  const clampedProgress = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const positions: UnfoldedFaceVertices = new Map(
    result.faces.map((face) => [
      face.id,
      face.flatVerticesMm.map((point) => [...point] as Vector3Mm) as [
        Vector3Mm,
        Vector3Mm,
        Vector3Mm,
      ],
    ]),
  );
  const descendants = descendantsByHinge(result);
  for (const hinge of result.hinges) {
    const axisStart = pointForSourceVertex(result, positions, hinge.parentFaceId, hinge.vertexA);
    const axisEnd = pointForSourceVertex(result, positions, hinge.parentFaceId, hinge.vertexB);
    if (!axisStart || !axisEnd) continue;
    const angleRadians = (hinge.foldAngleDeg * clampedProgress * Math.PI) / 180;
    for (const faceId of descendants.get(hinge.childFaceId) ?? []) {
      const facePositions = positions.get(faceId);
      if (!facePositions) continue;
      positions.set(
        faceId,
        facePositions.map((point) => rotateAroundAxis(point, axisStart, axisEnd, angleRadians)) as [
          Vector3Mm,
          Vector3Mm,
          Vector3Mm,
        ],
      );
    }
  }
  return positions;
}
