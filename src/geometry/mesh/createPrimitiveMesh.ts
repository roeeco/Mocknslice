import type { Bounds3D, SerializableTriangleMesh } from '../../domain/geometry';
import type { ModelHealthReport } from '../../domain/model';
import { validateMeshTopology } from './validateMesh';

export interface PrimitiveMeshResult {
  mesh: SerializableTriangleMesh;
  bounds: Bounds3D;
  healthReport: ModelHealthReport;
}

export function createCubeMesh(sizeMm: number): PrimitiveMeshResult {
  if (!Number.isFinite(sizeMm) || sizeMm <= 0) throw new Error('Cube size must be positive.');
  const half = sizeMm / 2;
  const positionsMm = [
    -half,
    -half,
    -half,
    half,
    -half,
    -half,
    half,
    half,
    -half,
    -half,
    half,
    -half,
    -half,
    -half,
    half,
    half,
    -half,
    half,
    half,
    half,
    half,
    -half,
    half,
    half,
  ];
  const indices = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2,
    6, 1, 6, 5,
  ];
  const mesh = { positionsMm, indices };
  return {
    mesh,
    bounds: { minMm: [-half, -half, -half], maxMm: [half, half, half] },
    healthReport: validateMeshTopology(mesh, positionsMm.length / 3),
  };
}
