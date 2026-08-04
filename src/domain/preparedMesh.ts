import type { SerializableTriangleMesh, Vector3Mm } from './geometry';

export interface Plane3D {
  normal: Vector3Mm;
  constantMm: number;
}

export interface PreparedPanel {
  id: string;
  sourceFaceIndices: number[];
  sourceVertexIndices: number[];
  boundaryLoops: number[][];
  plane: Plane3D;
  maximumPlanarityErrorMm: number;
}

export interface MeshPreparationMetrics {
  sourceTriangleCount: number;
  outputPanelCount: number;
  maximumDeviationMm: number;
  rmsDeviationMm: number;
  volumeDeltaPercent: number;
}

export interface PreparedMesh {
  sourceMesh: SerializableTriangleMesh;
  panels: PreparedPanel[];
  metrics: MeshPreparationMetrics;
  algorithmVersion: string;
}
