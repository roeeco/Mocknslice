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
  panelId?: string;
  edgeId?: string;
  tabId?: string;
  slot?: {
    pairedPartId: string;
    intersectionAxis: SliceAxis;
    centreMm: Millimetres;
    widthMm: Millimetres;
    depthMm: Millimetres;
    direction: 'start' | 'end';
  };
}

export interface FabricationLabel {
  id: string;
  text: string;
  position: Point2D;
  operation: 'engrave' | 'guide';
  entityId?: string;
}

export interface FabricationPart {
  id: string;
  name: string;
  label?: string;
  paths: FabricationPath[];
  labels?: FabricationLabel[];
  thicknessMm: Millimetres;
  sourceReference?: string;
  slice?: {
    axis: SliceAxis;
    positionMm: Millimetres;
    planeIndex: number;
  };
  waffle?: {
    family: 'a' | 'b';
    slotCount: number;
  };
  folding?: {
    templateKind: string;
    panelIds: string[];
  };
  unfolding?: {
    islandIndex: number;
    faceIds: string[];
  };
  construction?: {
    panelId: string;
    role: 'base' | 'front' | 'back' | 'left' | 'right' | 'lid';
    jointIds: string[];
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
