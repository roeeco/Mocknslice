import type { FabricationPart } from './fabrication';
import type { AssembledFoldPanel } from './folding';
import type { Millimetres, Point2D } from './geometry';
import type { MaterialCategory } from './material';
import type { ValidationIssue } from './validation';

export type PanelJointKind = 'butt' | 'finger' | 'tab-slot';
export type PanelDividerAxis = 'width' | 'depth';
export type PanelRole = 'base' | 'front' | 'back' | 'left' | 'right' | 'lid' | `divider-${number}`;
export type PanelEdgeName = 'bottom' | 'right' | 'top' | 'left';
export type PanelJointLocation = PanelEdgeName | 'face';

export interface PanelConstructionSettings {
  innerWidthMm: Millimetres;
  innerDepthMm: Millimetres;
  innerHeightMm: Millimetres;
  jointKind: PanelJointKind;
  fingerWidthMm: Millimetres;
  clearanceMm: Millimetres;
  includeLid: boolean;
  /** Legacy single-family divider settings retained for imported projects. */
  dividerCount?: number;
  dividerAxis?: PanelDividerAxis;
  widthDividerCount?: number;
  depthDividerCount?: number;
}

export interface PanelConstructionMaterial {
  id: string;
  category: MaterialCategory;
  thicknessMm: Millimetres;
  kerfMm: Millimetres;
}

export interface PanelConstructionPanel {
  id: string;
  partId: string;
  name: string;
  role: PanelRole;
  widthMm: Millimetres;
  heightMm: Millimetres;
  outline: Point2D[];
  edgeJointIds: Partial<Record<PanelEdgeName, string>>;
}

export interface PanelConstructionJoint {
  id: string;
  kind: PanelJointKind | 'half-lap';
  panelAId: string;
  panelBId: string;
  edgeA: PanelJointLocation;
  edgeB: PanelJointLocation;
  sharedLengthMm: Millimetres;
  fingerCount: number;
  clearanceMm: Millimetres;
  pairLabel: string;
  tabOwnerPanelId?: string;
  receiverCentreAMm?: Point2D;
  receiverCentreMm?: Point2D;
}

export interface PanelConstructionResult {
  settings: PanelConstructionSettings;
  material: PanelConstructionMaterial;
  panels: PanelConstructionPanel[];
  joints: PanelConstructionJoint[];
  parts: FabricationPart[];
  issues: ValidationIssue[];
  assembledPreview: { panels: AssembledFoldPanel[] };
  algorithmVersion: string;
  inputHash: string;
}
