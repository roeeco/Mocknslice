import type { Vector3Mm } from './geometry';

export type SurfacePatchKind =
  'planar' | 'cylindrical' | 'conical' | 'developable-strip' | 'compound-curved' | 'faceted';

export interface SurfacePatchClassification {
  kind: SurfacePatchKind;
  confidence: number;
  maximumGaussianCurvature: number;
  normalSpreadDeg: number;
  sharpEdgeRatio: number;
  estimatedAxis?: Vector3Mm;
  flatteningStrategy: 'planar' | 'analytic' | 'triangulated' | 'unsupported';
}

export interface FlatteningMetrics {
  maximumEdgeStrainPercent: number;
  rmsEdgeStrainPercent: number;
  areaDistortionPercent: number;
  maximumAngleDistortionDeg: number;
  flippedTriangleCount: number;
  maximumGaussianCurvature: number;
}
