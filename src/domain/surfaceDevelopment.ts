import type { Point2D } from './geometry';
import type { FlatteningMetrics, SurfacePatchKind } from './surfacePatch';

export interface DevelopedVertex {
  sourceVertexIndex: number;
  point: Point2D;
}

export interface SurfaceDevelopment {
  kind: Extract<SurfacePatchKind, 'planar' | 'cylindrical' | 'conical'>;
  vertices: DevelopedVertex[];
  metrics: FlatteningMetrics;
  withinTolerance: boolean;
  algorithmVersion: 'analytic-developable-v1';
}
