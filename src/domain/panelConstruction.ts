import type { FabricationPart } from './fabrication';
import type { AssembledFoldPanel, FoldTab } from './folding';
import type { Millimetres, Point2D } from './geometry';
import type { MaterialCategory } from './material';
import type { ValidationIssue } from './validation';
import type { PanelFeature } from './modeSettings';
import type { EditableAssemblyEdge, PanelConnectionTreatment } from './connections';

export type PanelJointKind = 'butt' | 'finger' | 'tab-slot';
export type CurrentPanelJointKind = Exclude<PanelJointKind, 'tab-slot'>;
export const PANEL_CONNECTION_KEYS = [
  'base-front',
  'base-back',
  'base-left',
  'base-right',
  'front-left',
  'front-right',
  'back-left',
  'back-right',
  'lid-front',
  'lid-back',
  'lid-left',
  'lid-right',
] as const;
export type PanelConnectionKey = (typeof PANEL_CONNECTION_KEYS)[number];
export interface PanelConnectionOverride {
  treatment: PanelConnectionTreatment;
  /** Shared fit allowance. Only meaningful for finger joints. */
  clearanceMm?: Millimetres;
  glueTabOwnerPanelId?: string;
}
export type PanelConnectionOverrides = Partial<Record<PanelConnectionKey, PanelConnectionOverride>>;

export const PANEL_PROFILE_KINDS = ['flat', 'arch', 'gable', 'stepped'] as const;
export type PanelProfileKind = (typeof PANEL_PROFILE_KINDS)[number];
export interface PanelProfiles {
  front: PanelProfileKind;
  back: PanelProfileKind;
}
export type PanelDividerAxis = 'width' | 'depth';
export type PanelRole = 'base' | 'front' | 'back' | 'left' | 'right' | 'lid' | `divider-${number}`;
export type PanelEdgeName = 'bottom' | 'right' | 'top' | 'left';
export type PanelJointLocation = PanelEdgeName | 'face';

export interface PanelBoundaryGlueTab {
  id: string;
  ownerPanelId: string;
  edgeId: string;
}

export interface PanelConstructionSettings {
  roleKerfMm?: { panel: number; divider: number; lid: number };
  roleClearanceMm?: { panel: number; divider: number; lid: number };
  innerWidthMm: Millimetres;
  innerDepthMm: Millimetres;
  innerHeightMm: Millimetres;
  jointKind: PanelJointKind;
  fingerWidthMm: Millimetres;
  clearanceMm: Millimetres;
  includeLid: boolean;
  /** Base and wall stock. Falls back to the material snapshot for legacy callers. */
  panelThicknessMm?: Millimetres;
  /** Divider stock. Falls back to panel thickness for legacy callers. */
  dividerThicknessMm?: Millimetres;
  /** Lid stock. Falls back to panel thickness for legacy callers. */
  lidThicknessMm?: Millimetres;
  /** Legacy single-family divider settings retained for imported projects. */
  dividerCount?: number;
  dividerAxis?: PanelDividerAxis;
  widthDividerCount?: number;
  depthDividerCount?: number;
  /** Shared specifications for paired enclosure connections. */
  connectionOverrides?: PanelConnectionOverrides;
  /** Bounded open-top silhouettes for the front and back panels. */
  panelProfiles?: PanelProfiles;
  glueTabDepthMm?: Millimetres;
  boundaryGlueTabs?: PanelBoundaryGlueTab[];
}

export const DEFAULT_PANEL_PROFILES: PanelProfiles = { front: 'flat', back: 'flat' };

export function hasRaisedPanelProfile(profiles: PanelProfiles | undefined): boolean {
  return profiles?.front !== undefined && profiles.front !== 'flat'
    ? true
    : profiles?.back !== undefined && profiles.back !== 'flat';
}

export const PANEL_THICKNESS_MIN_MM = 1;
export const PANEL_THICKNESS_MAX_MM = 10;
export const MINIMUM_CELL_THICKNESS_MULTIPLIER = 4;

export function clampPanelThickness(value: number): number {
  if (!Number.isFinite(value)) return PANEL_THICKNESS_MIN_MM;
  return Math.min(PANEL_THICKNESS_MAX_MM, Math.max(PANEL_THICKNESS_MIN_MM, value));
}

export function maximumPanelDividerCount(spanMm: number, dividerThicknessMm: number): number {
  if (!Number.isFinite(spanMm) || spanMm <= 0 || !Number.isFinite(dividerThicknessMm)) return 0;
  const thickness = clampPanelThickness(dividerThicknessMm);
  const minimumCellMm = thickness * MINIMUM_CELL_THICKNESS_MULTIPLIER;
  return Math.max(0, Math.floor((spanMm - minimumCellMm) / (thickness + minimumCellMm)));
}

export function panelCellMeasurements(settings: {
  innerWidthMm: number;
  innerDepthMm: number;
  innerHeightMm: number;
  dividerThicknessMm: number;
  widthDividerCount: number;
  depthDividerCount: number;
}): {
  count: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
} {
  const widthCells = settings.depthDividerCount + 1;
  const depthCells = settings.widthDividerCount + 1;
  return {
    count: widthCells * depthCells,
    widthMm:
      (settings.innerWidthMm - settings.depthDividerCount * settings.dividerThicknessMm) /
      widthCells,
    depthMm:
      (settings.innerDepthMm - settings.widthDividerCount * settings.dividerThicknessMm) /
      depthCells,
    heightMm: settings.innerHeightMm,
  };
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
  connectionKey?: PanelConnectionKey;
  kind: PanelJointKind | 'crease' | 'half-lap';
  panelAId: string;
  panelBId: string;
  edgeA: PanelJointLocation;
  edgeB: PanelJointLocation;
  sharedLengthMm: Millimetres;
  fingerCount: number;
  clearanceMm: Millimetres;
  pairLabel: string;
  tabOwnerPanelId?: string;
  tabIds?: string[];
  receiverCentreAMm?: Point2D;
  receiverCentreMm?: Point2D;
}

export interface PanelConstructionResult {
  settings: PanelConstructionSettings & { features?: PanelFeature[] };
  material: PanelConstructionMaterial;
  panels: PanelConstructionPanel[];
  joints: PanelConstructionJoint[];
  parts: FabricationPart[];
  issues: ValidationIssue[];
  assembledPreview: { panels: AssembledFoldPanel[] };
  tabs?: FoldTab[];
  editableEdges?: EditableAssemblyEdge[];
  algorithmVersion: string;
  inputHash: string;
}
