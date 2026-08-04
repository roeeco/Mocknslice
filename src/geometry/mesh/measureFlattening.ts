import type { Point2D, SerializableTriangleMesh, Vector3Mm } from '../../domain/geometry';
import type { FlatteningMetrics } from '../../domain/surfacePatch';
import { classifySurfacePatch } from './classifySurfacePatch';

function vertex3D(mesh: SerializableTriangleMesh, index: number): Vector3Mm {
  return [
    mesh.positionsMm[index * 3]!,
    mesh.positionsMm[index * 3 + 1]!,
    mesh.positionsMm[index * 3 + 2]!,
  ];
}

function distance3D(a: Vector3Mm, b: Vector3Mm): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function distance2D(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function triangleArea3D(a: Vector3Mm, b: Vector3Mm, c: Vector3Mm): number {
  const ab: Vector3Mm = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: Vector3Mm = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return (
    Math.hypot(
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ) / 2
  );
}

function signedArea2D(a: Point2D, b: Point2D, c: Point2D): number {
  return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
}

function triangleAngles(lengths: [number, number, number]): number[] {
  return lengths.map((opposite, index) => {
    const adjacentA = lengths[(index + 1) % 3]!;
    const adjacentB = lengths[(index + 2) % 3]!;
    const cosine = (adjacentA ** 2 + adjacentB ** 2 - opposite ** 2) / (2 * adjacentA * adjacentB);
    return Math.acos(Math.max(-1, Math.min(1, cosine)));
  });
}

export function measureFlattening(
  mesh: SerializableTriangleMesh,
  flattenedVertices: Point2D[],
): FlatteningMetrics {
  if (flattenedVertices.length !== mesh.positionsMm.length / 3) {
    throw new Error('Flattened vertex count must match the source mesh.');
  }
  const uniqueEdges = new Map<string, [number, number]>();
  const signedAreas: number[] = [];
  let sourceArea = 0;
  let flattenedArea = 0;
  let maximumAngleDistortion = 0;
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const triangle = [
      mesh.indices[index]!,
      mesh.indices[index + 1]!,
      mesh.indices[index + 2]!,
    ] as const;
    for (let edge = 0; edge < 3; edge += 1) {
      const a = triangle[edge]!;
      const b = triangle[(edge + 1) % 3]!;
      uniqueEdges.set(`${Math.min(a, b)}:${Math.max(a, b)}`, [a, b]);
    }
    const sourcePoints = triangle.map((vertexIndex) => vertex3D(mesh, vertexIndex));
    const flatPoints = triangle.map((vertexIndex) => flattenedVertices[vertexIndex]!);
    sourceArea += triangleArea3D(sourcePoints[0]!, sourcePoints[1]!, sourcePoints[2]!);
    const signedArea = signedArea2D(flatPoints[0]!, flatPoints[1]!, flatPoints[2]!);
    signedAreas.push(signedArea);
    flattenedArea += Math.abs(signedArea);
    const sourceLengths: [number, number, number] = [
      distance3D(sourcePoints[1]!, sourcePoints[2]!),
      distance3D(sourcePoints[2]!, sourcePoints[0]!),
      distance3D(sourcePoints[0]!, sourcePoints[1]!),
    ];
    const flatLengths: [number, number, number] = [
      distance2D(flatPoints[1]!, flatPoints[2]!),
      distance2D(flatPoints[2]!, flatPoints[0]!),
      distance2D(flatPoints[0]!, flatPoints[1]!),
    ];
    const sourceAngles = triangleAngles(sourceLengths);
    const flatAngles = triangleAngles(flatLengths);
    maximumAngleDistortion = Math.max(
      maximumAngleDistortion,
      ...sourceAngles.map((angle, angleIndex) => Math.abs(angle - flatAngles[angleIndex]!)),
    );
  }
  const strains = [...uniqueEdges.values()].map(([a, b]) => {
    const sourceLength = distance3D(vertex3D(mesh, a), vertex3D(mesh, b));
    return (
      (Math.abs(distance2D(flattenedVertices[a]!, flattenedVertices[b]!) - sourceLength) /
        sourceLength) *
      100
    );
  });
  const positiveAreas = signedAreas.filter((area) => area > 1e-9).length;
  const negativeAreas = signedAreas.filter((area) => area < -1e-9).length;
  return {
    maximumEdgeStrainPercent: Math.max(...strains, 0),
    rmsEdgeStrainPercent: Math.sqrt(
      strains.reduce((sum, strain) => sum + strain * strain, 0) / Math.max(1, strains.length),
    ),
    areaDistortionPercent:
      (Math.abs(flattenedArea - sourceArea) / Math.max(sourceArea, 1e-9)) * 100,
    maximumAngleDistortionDeg: (maximumAngleDistortion * 180) / Math.PI,
    flippedTriangleCount:
      Math.min(positiveAreas, negativeAreas) +
      signedAreas.filter((area) => Math.abs(area) <= 1e-9).length,
    maximumGaussianCurvature: classifySurfacePatch(mesh).maximumGaussianCurvature,
  };
}
