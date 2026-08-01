import type { FabricationPart } from './fabrication';
import type { AssembledFoldPanel } from './folding';
import type { Millimetres, Point2D } from './geometry';
import type { MaterialCategory } from './material';
import type { ValidationIssue } from './validation';

export type PanelJointKind = 'butt' | 'finger' | 'tab-slot';
export type PanelRole = 'base' | 'front' | 'back' | 'left' | 'right' | 'lid';
export type PanelEdgeName = 'bottom' | 'right' | 'top' | 'left';

export interface PanelConstructionSettings {
  innerWidthMm: Millimetres;
  innerDepthMm: Millimetres;
  innerHeightMm: Millimetres;
  jointKind: PanelJointKind;
  fingerWidthMm: Millimetres;
  clearanceMm: Millimetres;
  includeLid: boolean;
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
  kind: PanelJointKind;
  panelAId: string;
  panelBId: string;
  edgeA: PanelEdgeName;
  edgeB: PanelEdgeName;
  sharedLengthMm: Millimetres;
  fingerCount: number;
  clearanceMm: Millimetres;
  pairLabel: string;
  tabOwnerPanelId?: string;
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
