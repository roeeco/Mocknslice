import type { Millimetres, Vector3Mm } from './geometry';
import type { TemplateKind } from './folding';

export type PanelConnectionTreatment = 'finger' | 'butt' | 'crease';
export type FoldingConnectionTreatment = 'crease' | 'cut';
export type ConnectionClosure = 'none' | 'glue-tab' | 'press-fit';

export interface FoldingConnectionOverride {
  id: string;
  templateKind: TemplateKind;
  connectionId: string;
  treatment: FoldingConnectionTreatment;
  closure: ConnectionClosure;
  tabOwnerPanelId?: string;
}

export interface BoundaryGlueTab {
  id: string;
  templateKind: TemplateKind;
  edgeId: string;
  ownerPanelId: string;
}

export interface EditableAssemblyEdge {
  id: string;
  kind: 'connection' | 'boundary';
  panelAId: string;
  panelBId?: string;
  startMm: Vector3Mm;
  endMm: Vector3Mm;
  editable: boolean;
  unavailableReason?: string;
}

export interface ManualGlueTabSettings {
  depthMm: Millimetres;
}

export function clampGlueTabDepthMm(value: number): Millimetres {
  if (!Number.isFinite(value)) return 8;
  return Math.max(0.5, Math.min(15, value));
}
