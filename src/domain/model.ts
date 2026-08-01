import type {
  Bounds3D,
  Dimensions3D,
  SerializableTriangleMesh,
  Transform3D,
  Vector3Mm,
} from './geometry';

export type ImportFormat = 'stl' | 'obj' | 'glb' | 'gltf';

export interface BuiltInModelSource {
  kind: 'built-in';
  primitive: 'cube';
}

export interface ImportedModelSource {
  kind: 'imported';
  fileName: string;
  format: ImportFormat;
  embeddedData?: string;
}

export type ModelSource = BuiltInModelSource | ImportedModelSource;

export type StlUnit = 'millimetres' | 'centimetres' | 'metres' | 'inches';
export type ModelAxis = 'x' | 'y' | 'z';

export interface ModelImportSettings {
  assumedUnit: StlUnit;
  sourceUnitToMm: number;
  mergeToleranceMm: number;
  removedZeroAreaTriangleCount: number;
  centreOffsetMm: Vector3Mm;
  dimensionScale: number;
}

export interface ModelData {
  id: string;
  name: string;
  source: ModelSource;
  dimensions: Dimensions3D;
  transform: Transform3D;
  mesh?: SerializableTriangleMesh;
  bounds?: Bounds3D;
  healthReport?: ModelHealthReport;
  importSettings?: ModelImportSettings;
}

export interface ModelHealthReport {
  triangleCount: number;
  openEdgeCount: number;
  nonManifoldEdgeCount: number;
  disconnectedShellCount: number;
  orientationIssueCount: number;
  weldedVertexCount: number;
  signedVolumeMm3: number;
  likelyInverted: boolean;
  inspected: boolean;
}
