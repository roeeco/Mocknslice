import type { Dimensions3D, Transform3D } from './geometry';

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

export interface ModelData {
  id: string;
  name: string;
  source: ModelSource;
  dimensions: Dimensions3D;
  transform: Transform3D;
}

export interface ModelHealthReport {
  triangleCount: number;
  openEdgeCount: number;
  nonManifoldEdgeCount: number;
  disconnectedShellCount: number;
  orientationIssueCount: number;
  inspected: boolean;
}
