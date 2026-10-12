import type { PapercraftResult, PapercraftSettingsV2 } from './papercraft';
import type { ExportSettings } from './exports';
import type { FabricationMode, FabricationPart, SheetLayout } from './fabrication';
import type { MaterialProfile } from './material';
import type { ModelData } from './model';
import type { ValidationIssue } from './validation';
import type { TemplateGenerationResult } from './folding';
import type { MeshUnfoldResult } from './unfolding';
import type { PanelConstructionResult } from './panelConstruction';
import type { GenerationRecord } from './generation';
import type { LegacyModeParameters, ModeSettingsByMode } from './modeSettings';

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectData {
  papercraft?:
    | { settings: PapercraftSettingsV2; acceptSimplification: boolean; result?: PapercraftResult }
    | undefined;
  metadata: ProjectMetadata;
  model: ModelData;
  fabricationMode: FabricationMode;
  materialProfileSnapshot: MaterialProfile;
  modeSettings: ModeSettingsByMode;
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

export type LegacyProjectData = Omit<ProjectData, 'modeSettings'> & {
  modeParameters: LegacyModeParameters;
};

export interface SliceFoldProjectFileV1 {
  format: 'slicefold-project';
  version: 1;
  project: LegacyProjectData;
}

export interface SliceFoldProjectFileV2 {
  format: 'slicefold-project';
  version: 2;
  project: LegacyProjectData;
}

export interface SliceFoldProjectFileV3 {
  format: 'slicefold-project';
  version: 3;
  project: LegacyProjectData;
}

export interface SliceFoldProjectFileV4 {
  format: 'slicefold-project';
  version: 4;
  project: LegacyProjectData;
}

export interface SliceFoldProjectFileV5 {
  format: 'slicefold-project';
  version: 5;
  project: LegacyProjectData;
}

export interface MocknSliceProjectFileV6 {
  format: 'mocknslice-project';
  version: 6;
  project: LegacyProjectData;
}

export interface MocknSliceProjectFileV7 {
  format: 'mocknslice-project';
  version: 7;
  project: ProjectData;
}

export interface MocknSliceProjectFileV8 {
  format: 'mocknslice-project';
  version: 8;
  project: ProjectData;
}

export interface MocknSliceProjectFileV9 {
  format: 'mocknslice-project';
  version: 9;
  project: ProjectData;
}

export type SliceFoldProjectFile =
  | SliceFoldProjectFileV1
  | SliceFoldProjectFileV2
  | SliceFoldProjectFileV3
  | SliceFoldProjectFileV4
  | SliceFoldProjectFileV5
  | MocknSliceProjectFileV6
  | MocknSliceProjectFileV7
  | MocknSliceProjectFileV8
  | MocknSliceProjectFileV9;
