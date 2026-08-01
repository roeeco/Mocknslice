import type { StateCreator } from 'zustand';
import type { ExportSettings } from '../domain/exports';
import type { FabricationMode } from '../domain/fabrication';
import type { MaterialProfile } from '../domain/material';
import type { ModelHealthReport } from '../domain/model';
import type { ProjectData } from '../domain/project';
import type { ValidationIssue } from '../domain/validation';

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
export type ViewportMode = 'three' | 'two';
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
  modelHealthReport: ModelHealthReport;
  setModelHealthReport: (report: ModelHealthReport) => void;
}

export interface FabricationSlice {
  setFabricationMode: (mode: FabricationMode) => void;
  setModeParameter: (name: string, value: number | string | boolean) => void;
}

export interface ViewportSlice {
  viewportMode: ViewportMode;
  cameraPreset: CameraPreset;
  activeWorkflowStep: WorkflowStep;
  setViewportMode: (mode: ViewportMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setActiveWorkflowStep: (step: WorkflowStep) => void;
}

export interface SelectionSlice {
  selectedEntityId: string | undefined;
  selectEntity: (id?: string) => void;
}

export interface MaterialLibrarySlice {
  materials: readonly MaterialProfile[];
  selectMaterial: (id: string) => void;
}

export interface HistorySlice {
  past: ProjectData[];
  future: ProjectData[];
  undo: () => void;
  redo: () => void;
}

export interface ExportSlice {
  updateExportSettings: (settings: Partial<ExportSettings>) => void;
}

export interface ValidationSlice {
  validationIssues: ValidationIssue[];
  setValidationIssues: (issues: ValidationIssue[]) => void;
}

export type AppState = ProjectSlice &
  ModelSlice &
  FabricationSlice &
  ViewportSlice &
  SelectionSlice &
  MaterialLibrarySlice &
  HistorySlice &
  ExportSlice &
  ValidationSlice;

export type AppSliceCreator<T> = StateCreator<AppState, [], [], T>;
