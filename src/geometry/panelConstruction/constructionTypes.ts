import type {
  PanelConnectionKey,
  PanelConstructionMaterial,
  PanelConstructionSettings,
  PanelEdgeName,
  PanelProfileKind,
  PanelRole,
} from '../../domain/panelConstruction';
import type { PanelFeature } from '../../domain/modeSettings';
import type { Point2D } from '../../domain/geometry';
import type { PanelConnectionTreatment } from '../../domain/connections';

export interface PanelConstructionInput {
  sourceId?: string;
  /** Legacy compatibility for direct geometry callers. */
  modelId?: string;
  material: PanelConstructionMaterial;
  settings: PanelConstructionSettings & { features?: PanelFeature[] };
}

export interface PanelSpec {
  role: PanelRole;
  name: string;
  widthMm: number;
  heightMm: number;
  dividerAxis?: 'width' | 'depth';
  dividerPositionMm?: number;
  crossingSlotCentresMm?: number[];
  tabCentresMm?: number[];
  profile?: PanelProfileKind;
}

export interface JointSpec {
  connectionKey?: PanelConnectionKey;
  panelA: PanelRole;
  panelB: PanelRole;
  edgeA: PanelEdgeName;
  edgeB: PanelEdgeName;
  lengthMm: number;
}

export interface DividerSideJointSpec {
  dividerRole: `divider-${number}`;
  receiverRole: 'front' | 'back' | 'left' | 'right';
  dividerEdge: 'left' | 'right';
  receiverCentreMm: Point2D;
  lengthMm: number;
}

export interface EdgeTreatment {
  jointId: string;
  kind: PanelConnectionTreatment;
  segmentCount: number;
  phase: 0 | 1;
  relief: 'protrude' | 'inset';
  depthMm: number;
  clearanceMm: number;
  startGuardMm: number;
  endGuardMm: number;
  startFingerExtensionMm: number;
  endFingerExtensionMm: number;
  suppressStartFinger: boolean;
  suppressEndFinger: boolean;
}

export interface HorizontalEdgeFeature {
  centreMm: number;
  widthMm: number;
  depthMm: number;
}
