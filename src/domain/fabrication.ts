import type { Millimetres, Point2D } from './geometry';
import type { OperationType } from './operations';

export type SliceAxis = 'x' | 'y' | 'z';
export type ContourRole = 'outer' | 'hole';

export type FabricationMode =
  'stacked-slices' | 'waffle-slices' | 'fold-template' | 'mesh-unfold' | 'panel-construction';

export interface FabricationPath {
  id: string;
  operation: OperationType;
  closed: boolean;
  points: Point2D[];
  contourRole?: ContourRole;
}

export interface FabricationPart {
  id: string;
  name: string;
  label?: string;
  paths: FabricationPath[];
  thicknessMm: Millimetres;
  sourceReference?: string;
  slice?: {
    axis: SliceAxis;
    positionMm: Millimetres;
    planeIndex: number;
  };
}

export interface SheetPlacement {
  partId: string;
  x: Millimetres;
  y: Millimetres;
  rotationDeg: number;
}

export interface SheetLayout {
  id: string;
  widthMm: Millimetres;
  heightMm: Millimetres;
  marginMm: Millimetres;
  spacingMm: Millimetres;
  placements: SheetPlacement[];
}
