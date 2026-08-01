import type { ExportSettings } from './exports';
import type { FabricationMode, FabricationPart, SheetLayout } from './fabrication';
import type { MaterialProfile } from './material';
import type { ModelData } from './model';
import type { ValidationIssue } from './validation';
import type { TemplateGenerationResult } from './folding';

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
  generationIssues?: ValidationIssue[];
  foldingResult?: TemplateGenerationResult | undefined;
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

export type SliceFoldProjectFile =
  SliceFoldProjectFileV1 | SliceFoldProjectFileV2 | SliceFoldProjectFileV3;
