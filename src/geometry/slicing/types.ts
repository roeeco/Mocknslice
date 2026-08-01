import type { Bounds3D, Point2D, SerializableTriangleMesh } from '../../domain/geometry';
import type { FabricationPart, SliceAxis } from '../../domain/fabrication';
import type { ValidationIssue } from '../../domain/validation';

export interface StackedSliceSettings {
  axis: SliceAxis;
  spacingMm: number;
  thicknessMm: number;
  contourEpsilonMm: number;
}

export interface SliceSegment {
  start: Point2D;
  end: Point2D;
}

export interface SliceContour {
  points: Point2D[];
  closed: boolean;
}

export interface ClassifiedContour extends SliceContour {
  role: 'outer' | 'hole';
  parentOuterIndex?: number;
}

export interface StackedSliceInput {
  mesh: SerializableTriangleMesh;
  bounds: Bounds3D;
  settings: StackedSliceSettings;
  modelId: string;
}

export interface StackedSliceResult {
  parts: FabricationPart[];
  issues: ValidationIssue[];
  planePositionsMm: number[];
}
