import type { PapercraftKernelInput, PapercraftResult } from '../domain/papercraft';
import type { PapercraftWorkingSource } from '../domain/papercraft';
import type { PapercraftRelinkProposal } from '../geometry/papercraft/relinkOnModelUpdate';
import type { ModelData } from '../domain/model';
import type { UserTemplateDefinition } from '../templates/authoring/types';
import type { FabricationProfile } from '../geometry/output/fabricationProfiles';
import type {
  PapercraftEdgeEdit,
  PapercraftIslandEdit,
  PapercraftProgress,
  PapercraftSettingsV2,
} from '../domain/papercraft';
import type { StateCreator } from 'zustand';
import type { ExportSettings } from '../domain/exports';
import type { FabricationMode, FabricationPart, SheetLayout } from '../domain/fabrication';
import type { MaterialProfile } from '../domain/material';
import type { TemplateKind } from '../domain/folding';
import type { ModelAxis, StlUnit } from '../domain/model';
import type { NormalizedMeshResult } from '../geometry/mesh/normalizeMesh';
import type { ProjectData } from '../domain/project';
import type { ValidationIssue } from '../domain/validation';
import type { Locale } from '../locales';
import type { RuntimeFailure } from '../domain/runtimeFailure';
import type { StackedSliceSettings, WaffleSliceSettings } from '../domain/slicing';
import type {
  FoldTemplateSettings,
  PanelComposerSettings,
  PanelFeature,
} from '../domain/modeSettings';
import type { MeshUnfoldSettings } from '../domain/unfolding';
import type { ClassroomRecipeId } from '../domain/classroomRecipes';

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
export type ViewportMode = 'three' | 'two';
export type ExperienceMode = 'standard' | 'advanced';
export type CameraPreset = 'isometric' | 'front' | 'side' | 'top';
export type WorkflowStep =
  'start' | 'mode' | 'import' | 'configure' | 'inspect' | 'arrange' | 'export';

export interface ProjectSlice {
  project: ProjectData;
  hasHydrated: boolean;
  autosaveStatus: AutosaveStatus;
  createNewProject: (name?: string) => void;
  hydrateProject: (project?: ProjectData) => void;
  renameProject: (name: string) => void;
  replaceProject: (project: ProjectData) => void;
  setAutosaveStatus: (status: AutosaveStatus) => void;
}

export interface ModelSlice {
  assumedStlUnit: StlUnit;
  modelImportStatus: 'idle' | 'processing' | 'ready' | 'error' | 'cancelled';
  modelImportError: RuntimeFailure | undefined;
  setAssumedStlUnit: (unit: StlUnit) => void;
  startModelImport: () => void;
  completeModelImport: (fileName: string, result: NormalizedMeshResult) => void;
  failModelImport: (failure: RuntimeFailure) => void;
  cancelModelImport: () => void;
  rotateModel90: (axis: ModelAxis) => void;
  scaleModelToDimension: (axis: ModelAxis, targetMm: number) => void;
  scaleModelToLongestDimension: (targetMm: number) => void;
}

export interface FabricationSlice {
  generationDraft:
    { source: ProjectData; parts: FabricationPart[]; issues: ValidationIssue[] } | undefined;
  sliceGenerationStatus: 'idle' | 'processing' | 'ready' | 'error' | 'cancelled' | 'stale';
  sliceGenerationError: RuntimeFailure | undefined;
  setFabricationMode: (mode: FabricationMode) => void;
  setWorkflowSourceMode: (mode: 'import' | 'template') => void;
  selectTemplateSource: (kind: TemplateKind) => void;
  updateStackedSliceSettings: (patch: Partial<StackedSliceSettings>) => void;
  updateWaffleSliceSettings: (patch: Partial<WaffleSliceSettings>) => void;
  updateFoldTemplateSettings: (patch: Partial<FoldTemplateSettings>) => void;
  updateMeshUnfoldSettings: (patch: Partial<MeshUnfoldSettings>) => void;
  updatePanelComposerSettings: (patch: Partial<PanelComposerSettings>) => void;
  replacePanelComposerSettings: (settings: PanelComposerSettings) => void;
  applyPanelRecipe: (id: ClassroomRecipeId) => void;
  addPanelFeature: (feature: PanelFeature) => void;
  updatePanelFeature: (id: string, feature: PanelFeature) => void;
  duplicatePanelFeature: (id: string, newId: string) => void;
  removePanelFeature: (id: string) => void;
  generateSlices: () => void;
  generateWaffleSlices: () => void;
  generateFoldTemplate: (options?: { mergeWithInputEdit?: boolean }) => void;
  generateMeshUnfold: () => void;
  generatePanelConstruction: () => void;
  cancelSliceGeneration: () => void;
}

export interface PapercraftSlice {
  papercraftCandidate:
    | { sourceProject: ProjectData; result: PapercraftResult; input: PapercraftKernelInput }
    | undefined;
  papercraftProgress: PapercraftProgress | undefined;
  papercraftIssues: ValidationIssue[];
  enablePapercraft: () => void;
  useLegacyUnfolding: () => void;
  updatePapercraftSettings: (
    patch: Partial<
      Omit<
        PapercraftSettingsV2,
        'algorithmVersion' | 'sourceMeshHash' | 'edgeEdits' | 'islandEdits'
      >
    >,
    acceptSimplification?: boolean,
  ) => void;
  editPapercraftEdge: (edit: PapercraftEdgeEdit) => void;
  editPapercraftIsland: (edit: PapercraftIslandEdit) => void;
  generatePapercraft: (options?: { mergeWithInputEdit?: boolean }) => void;
}

export interface LayoutSlice {
  arrangeGeneratedPartsOptimized: () => void;
  setPartPlacementLocked: (partId: string, locked: boolean) => void;
  activeSheetId: string | undefined;
  setActiveSheet: (sheetId: string) => void;
  arrangeGeneratedParts: () => void;
  updateSheetSettings: (
    sheetId: string,
    settings: Partial<Pick<SheetLayout, 'widthMm' | 'heightMm' | 'marginMm' | 'spacingMm'>>,
  ) => void;
  addSheet: () => void;
  duplicateSheet: (sheetId: string) => void;
  removeSheet: (sheetId: string) => void;
  updatePartPlacement: (
    sheetId: string,
    partId: string,
    placement: { x: number; y: number; rotationDeg?: number },
  ) => void;
  rotatePartPlacement: (sheetId: string, partId: string, deltaDeg?: number) => void;
  movePartToSheet: (partId: string, sheetId: string) => void;
}

export interface ViewportSlice {
  locale: Locale;
  experienceMode: ExperienceMode;
  viewportMode: ViewportMode;
  cameraPreset: CameraPreset;
  cameraResetToken: number;
  activeWorkflowStep: WorkflowStep;
  completedWorkflowSteps: WorkflowStep[];
  foldPreviewProgress: number;
  setViewportMode: (mode: ViewportMode) => void;
  setLocale: (locale: Locale) => void;
  setExperienceMode: (mode: ExperienceMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  fitCamera: () => void;
  setActiveWorkflowStep: (step: WorkflowStep) => void;
  completeWorkflowStep: (step: WorkflowStep) => void;
  invalidateWorkflowFrom: (step: WorkflowStep) => void;
  setFoldPreviewProgress: (progress: number) => void;
}

export interface SelectionSlice {
  selectedPartId: string | undefined;
  selectedEntityId: string | undefined;
  selectEntity: (id?: string, ownerPartId?: string) => void;
}

export interface MaterialLibrarySlice {
  materials: readonly MaterialProfile[];
  selectMaterial: (id: string) => void;
  updateCustomMaterial: (patch: Partial<MaterialProfile>) => void;
}

export interface HistorySlice {
  past: ProjectData[];
  future: ProjectData[];
  undo: () => void;
  redo: () => void;
}

export interface ExportSlice {
  fabricationProfile: FabricationProfile;
  setFabricationProfile: (profile: FabricationProfile) => void;
  acknowledgeFabricationWarnings: (ids: string[], accepted: boolean) => void;
  updateExportSettings: (settings: Partial<ExportSettings>) => void;
}

export interface ValidationSlice {
  validationIssues: ValidationIssue[];
  setValidationIssues: (issues: ValidationIssue[]) => void;
}

export type AppState = SourceUpdateSlice &
  TemplateAuthoringSlice &
  PapercraftSlice &
  ProjectSlice &
  ModelSlice &
  FabricationSlice &
  LayoutSlice &
  ViewportSlice &
  SelectionSlice &
  MaterialLibrarySlice &
  HistorySlice &
  ExportSlice &
  ValidationSlice;

export type AppSliceCreator<T> = StateCreator<AppState, [], [], T>;

export interface TemplateAuthoringSlice {
  applyTemplateDefinition: (
    definition: UserTemplateDefinition,
    values?: Record<string, number>,
  ) => void;
  updateTemplateValues: (values: Record<string, number>) => void;
  resetTemplateValues: () => void;
}

export interface SourceUpdateSlice {
  pendingModelUpdate:
    | {
        originalProject: ProjectData;
        model: ModelData;
        settings: PapercraftSettingsV2;
        workingSource: PapercraftWorkingSource | undefined;
        proposal: PapercraftRelinkProposal;
      }
    | undefined;
  proposePapercraftModelUpdate: (model: ModelData) => void;
  acceptPapercraftModelUpdate: () => void;
  cancelPapercraftModelUpdate: () => void;
  resolvePapercraftEdit: (id: string, targetId?: string) => void;
}
