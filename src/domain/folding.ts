import type { FabricationPart, SliceAxis } from './fabrication';
import type { Millimetres, Point2D, Vector3Mm } from './geometry';
import type { ValidationIssue } from './validation';

export const TEMPLATE_KINDS = [
  'open-box',
  'box-with-lid',
  'tray',
  'sleeve',
  'envelope',
  'regular-prism',
  'pyramid-frustum',
] as const;

export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export type TemplateSizeMode = 'auto-fit' | 'custom';
export type FoldClosureMethod = 'glue' | 'press-fit';

export interface TemplateEnvelopeDimensions {
  widthMm: Millimetres;
  lengthMm: Millimetres;
  heightMm: Millimetres;
}

export interface TemplateFitSettings {
  templateKind: TemplateKind;
  fitAxis: SliceAxis;
  clearanceMm: Millimetres;
  profileToleranceMm: Millimetres;
  sizeMode?: TemplateSizeMode;
  envelopeDimensions?: TemplateEnvelopeDimensions;
  parameters: Record<string, number | string | boolean>;
}

export interface ProjectedProfile {
  sourceModelId: string;
  fitAxis: SliceAxis;
  sourceHullPoints: Point2D[];
  fittedPoints: Point2D[];
  clearanceMm: Millimetres;
  simplificationToleranceMm: Millimetres;
  axisMinMm: Millimetres;
  axisMaxMm: Millimetres;
  widthMm: Millimetres;
  heightMm: Millimetres;
  depthMm: Millimetres;
}

export interface FoldPanel {
  id: string;
  partId: string;
  name: string;
  role: 'face' | 'wall' | 'band' | 'base' | 'lid' | 'side';
  outline: Point2D[];
}

export interface FoldEdgeDefinition {
  id: string;
  partId: string;
  panelAId: string;
  panelBId?: string;
  disposition: 'boundary' | 'hinge' | 'seam';
  foldDirection?: 'mountain' | 'valley';
  targetAngleDeg?: number;
  pairLabel?: string;
  start: Point2D;
  end: Point2D;
}

export interface FoldTab {
  id: string;
  partId: string;
  edgeId: string;
  ownerPanelId: string;
  style: FoldClosureMethod;
  depthMm: Millimetres;
  shoulderAngleDeg: number;
  enabled: boolean;
  baseStart: Point2D;
  baseEnd: Point2D;
  outline: Point2D[];
  receiverPanelId?: string;
  slotStart?: Point2D;
  slotEnd?: Point2D;
}

export interface AssembledFoldPanel {
  id: string;
  partId: string;
  name: string;
  verticesMm: Vector3Mm[];
  holesVerticesMm?: Vector3Mm[][];
}

export interface TemplateGenerationResult {
  settings: TemplateFitSettings;
  profile: ProjectedProfile;
  panels: FoldPanel[];
  edges: FoldEdgeDefinition[];
  tabs: FoldTab[];
  parts: FabricationPart[];
  issues: ValidationIssue[];
  assembledPreview: {
    panels: AssembledFoldPanel[];
  };
  resolvedDimensions?: TemplateEnvelopeDimensions;
  algorithmVersion: string;
  inputHash: string;
}
