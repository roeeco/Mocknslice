import type { FabricationLabel, FabricationPart, FabricationPath } from './fabrication';
import type { Point2D } from './geometry';
import type { OperationType } from './operations';
import type { ValidationIssue } from './validation';

export interface DesignVertex extends Point2D {
  id: string;
}

export interface DesignPanel {
  id: string;
  pieceId: string;
  name: string;
  vertices: DesignVertex[];
  boundary: string[];
  holes: string[][];
  materialThicknessMm: number;
  sourceFaceIds?: string[];
  /** Column-major rigid 4x4 matrix: panel's flat XY millimetres → assembled XYZ. */
  assembledPose?: number[];
  /** Legacy assembled inventory ordering, including an explicit repeated closure if present. */
  assemblyBoundary?: string[];
}

export interface DesignConnection {
  id: string;
  panelAId: string;
  panelBId?: string;
  edgeA: { a: string; b: string };
  edgeB?: { a: string; b: string };
  treatment: 'hinge' | 'seam' | 'finger' | 'butt';
  /** True only when this pair is joined in the same flat island. */
  flatJoined: boolean;
  /** Signed angle around A's oriented edge; positive is right-hand rotation. */
  foldAngleDeg?: number;
  closure: 'none' | 'glue-tab' | 'press-fit';
  tabOwnerPanelId?: string;
  required: boolean;
}

export interface DesignFeature {
  id: string;
  pieceId: string;
  hostPanelId?: string;
  kind: 'contour' | 'hole' | 'tab' | 'score' | 'engrave' | 'notch' | 'slot' | 'guide';
  operation: OperationType;
  geometry2D: Point2D[];
  // Geometry is authoritative here; metadata never contains a duplicate point array.
  path?: Omit<FabricationPath, 'points'>;
  label?: Omit<FabricationLabel, 'position'>;
}

export interface DesignPiece {
  id: string;
  metadata: Omit<FabricationPart, 'paths' | 'labels'>;
  /** Explicit legacy order preserves byte-for-byte exporter compatibility. */
  pathIds: string[];
  labelIds: string[];
  labelsPresent?: boolean;
}

export interface FabricationDesignGraph {
  schemaVersion: 1;
  units: 'mm';
  source: {
    kind: 'template' | 'mesh' | 'panel-construction' | 'slicing';
    sourceId: string;
    algorithmVersion: string;
    inputHash: string;
  };
  panels: DesignPanel[];
  connections: DesignConnection[];
  features: DesignFeature[];
  pieces: DesignPiece[];
  issues: ValidationIssue[];
  /** Legacy adapters preserve open paths as inspection data; never certify them. */
  manufacturingStatus: 'legacy-unverified' | 'validated';
}
