import type { SerializableTriangleMesh, Vector3Mm } from '../../domain/geometry';

export interface MeshDeviationMetrics {
  maximumDeviationMm: number;
  rmsDeviationMm: number;
}

function vertices(mesh: SerializableTriangleMesh): Vector3Mm[] {
  const result: Vector3Mm[] = [];
  for (let index = 0; index < mesh.positionsMm.length; index += 3) {
    result.push([
      mesh.positionsMm[index]!,
      mesh.positionsMm[index + 1]!,
      mesh.positionsMm[index + 2]!,
    ]);
  }
  return result;
}

export function measureMeshDeviation(
  source: SerializableTriangleMesh,
  output: SerializableTriangleMesh,
): MeshDeviationMetrics {
  const sourceVertices = vertices(source);
  const distances = vertices(output).map((point) =>
    Math.min(
      ...sourceVertices.map((sourcePoint) =>
        Math.hypot(point[0] - sourcePoint[0], point[1] - sourcePoint[1], point[2] - sourcePoint[2]),
      ),
    ),
  );
  return {
    maximumDeviationMm: Math.max(...distances, 0),
    rmsDeviationMm: Math.sqrt(
      distances.reduce((sum, distance) => sum + distance * distance, 0) /
        Math.max(1, distances.length),
    ),
  };
}
