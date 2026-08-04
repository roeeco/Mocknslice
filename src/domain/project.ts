import type { ExportSettings } from './exports';
import type { FabricationMode, FabricationPart, SheetLayout } from './fabrication';
import type { MaterialProfile } from './material';
import type { ModelData } from './model';
import type { ValidationIssue } from './validation';
import type { TemplateGenerationResult } from './folding';
import type { MeshUnfoldResult } from './unfolding';
import type { PanelConstructionResult } from './panelConstruction';
import type { GenerationRecord } from './generation';

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectData {
  metadata: ProjectMetadata;
  model: ModelData;
  fabricationMode: FabricationMode;
  materialProfileSnapshot: MaterialProfile;
  modeParameters: Record<string, number | string | boolean>;
  generatedParts: FabricationPart[];
  generationRecord?: GenerationRecord;
  generationIssues?: ValidationIssue[];
  foldingResult?: TemplateGenerationResult | undefined;
  unfoldingResult?: MeshUnfoldResult | undefined;
  panelConstructionResult?: PanelConstructionResult | undefined;
  sheetLayouts: SheetLayout[];
  exportSettings: ExportSettings;
  acknowledgedWarningIds: string[];
}

export interface SliceFoldProjectFileV1 {
  format: 'slicefold-project';
  version: 1;
  project: ProjectData;
}

export interface SliceFoldProjectFileV2 {
  format: 'slicefold-project';
  version: 2;
  project: ProjectData;
}

export interface SliceFoldProjectFileV3 {
  format: 'slicefold-project';
  version: 3;
  project: ProjectData;
}

export interface SliceFoldProjectFileV4 {
  format: 'slicefold-project';
  version: 4;
  project: ProjectData;
}

export interface SliceFoldProjectFileV5 {
  format: 'slicefold-project';
  version: 5;
  project: ProjectData;
}

export interface MocknSliceProjectFileV6 {
  format: 'mocknslice-project';
  version: 6;
  project: ProjectData;
}

export type SliceFoldProjectFile =
  | SliceFoldProjectFileV1
  | SliceFoldProjectFileV2
  | SliceFoldProjectFileV3
  | SliceFoldProjectFileV4
  | SliceFoldProjectFileV5
  | MocknSliceProjectFileV6;
