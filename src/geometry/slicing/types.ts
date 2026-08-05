import type { Bounds3D, Point2D, SerializableTriangleMesh } from '../../domain/geometry';
import type { FabricationPart } from '../../domain/fabrication';
import type { ValidationIssue } from '../../domain/validation';
import type { StackedSliceSettings, WaffleSliceSettings } from '../../domain/slicing';

export type {
  StackedSliceSettings,
  WaffleSliceSettings,
  WaffleSlotPattern,
} from '../../domain/slicing';

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

export interface WaffleSliceInput {
  mesh: SerializableTriangleMesh;
  bounds: Bounds3D;
  settings: WaffleSliceSettings;
  modelId: string;
}

export interface WaffleSliceResult {
  parts: FabricationPart[];
  issues: ValidationIssue[];
  primaryPlanePositionsMm: number[];
  secondaryPlanePositionsMm: number[];
  slotCount: number;
}
