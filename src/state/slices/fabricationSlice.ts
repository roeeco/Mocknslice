import type { AppSliceCreator, FabricationSlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';
import { validationIssuesForProject } from '../../validation/projectValidation';
import {
  generateStackedSlicesInWorker,
  generateWaffleSlicesInWorker,
  type GeometryTask,
} from '../../workers/geometryWorkerClient';
import type { SliceAxis } from '../../domain/fabrication';
import type { ProjectData } from '../../domain/project';
import type {
  StackedSliceSettings,
  WaffleSliceResult,
  WaffleSliceSettings,
  WaffleSlotPattern,
} from '../../geometry/slicing/types';
import { arrangePartsInRows } from '../../geometry/layout/arrangeParts';

let activeTask: Pick<GeometryTask<unknown>, 'cancel'> | undefined;

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function settingsForProject(project: ProjectData): StackedSliceSettings {
  return {
    axis: (project.modeParameters.sliceAxis as SliceAxis | undefined) ?? 'z',
    spacingMm: positiveNumber(project.modeParameters.spacingMm, 10),
    thicknessMm: positiveNumber(
      project.modeParameters.sliceThicknessMm,
      project.materialProfileSnapshot.thicknessMm,
    ),
    contourEpsilonMm: positiveNumber(project.modeParameters.contourEpsilonMm, 0.001),
  };
}

function settingsMatch(a: StackedSliceSettings, b: StackedSliceSettings): boolean {
  return (
    a.axis === b.axis &&
    a.spacingMm === b.spacingMm &&
    a.thicknessMm === b.thicknessMm &&
    a.contourEpsilonMm === b.contourEpsilonMm
  );
}

function waffleSettingsForProject(project: ProjectData): WaffleSliceSettings {
  return {
    primaryAxis: (project.modeParameters.wafflePrimaryAxis as SliceAxis | undefined) ?? 'x',
    secondaryAxis: (project.modeParameters.waffleSecondaryAxis as SliceAxis | undefined) ?? 'y',
    primarySpacingMm: positiveNumber(project.modeParameters.wafflePrimarySpacingMm, 20),
    secondarySpacingMm: positiveNumber(project.modeParameters.waffleSecondarySpacingMm, 20),
    thicknessMm: positiveNumber(
      project.modeParameters.waffleThicknessMm,
      project.materialProfileSnapshot.thicknessMm,
    ),
    clearanceMm: nonNegativeNumber(
      project.modeParameters.waffleClearanceMm,
      project.materialProfileSnapshot.clearanceMm,
    ),
    contourEpsilonMm: positiveNumber(project.modeParameters.contourEpsilonMm, 0.001),
    slotPattern:
      (project.modeParameters.waffleSlotPattern as WaffleSlotPattern | undefined) ?? 'alternating',
    reverseSlots: Boolean(project.modeParameters.waffleReverseSlots),
  };
}

function waffleSettingsMatch(a: WaffleSliceSettings, b: WaffleSliceSettings): boolean {
  return (
    a.primaryAxis === b.primaryAxis &&
    a.secondaryAxis === b.secondaryAxis &&
    a.primarySpacingMm === b.primarySpacingMm &&
    a.secondarySpacingMm === b.secondarySpacingMm &&
    a.thicknessMm === b.thicknessMm &&
    a.clearanceMm === b.clearanceMm &&
    a.contourEpsilonMm === b.contourEpsilonMm &&
    a.slotPattern === b.slotPattern &&
    a.reverseSlots === b.reverseSlots
  );
}

export const createFabricationSlice: AppSliceCreator<FabricationSlice> = (set, get) => ({
  sliceGenerationStatus: 'idle',
  sliceGenerationError: undefined,
  setFabricationMode: (fabricationMode) =>
    set((state) => ({
      ...recordProjectChange(state, (project) => touchProject({ ...project, fabricationMode })),
      sliceGenerationStatus:
        state.project.generatedParts.length > 0 ? 'stale' : state.sliceGenerationStatus,
    })),
  setModeParameter: (name, value) =>
    set((state) => ({
      ...recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          modeParameters: { ...project.modeParameters, [name]: value },
        }),
      ),
      sliceGenerationStatus:
        state.project.generatedParts.length > 0 ? 'stale' : state.sliceGenerationStatus,
      sliceGenerationError: undefined,
    })),
  generateSlices: () => {
    const { project } = get();
    if (!project.model.mesh || !project.model.bounds) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: 'This model has no sliceable mesh.',
      });
      return;
    }
    activeTask?.cancel();
    const settings = settingsForProject(project);
    const sourceMesh = project.model.mesh;
    const task = generateStackedSlicesInWorker({
      mesh: sourceMesh,
      bounds: project.model.bounds,
      modelId: project.model.id,
      settings,
    });
    activeTask = task;
    set({ sliceGenerationStatus: 'processing', sliceGenerationError: undefined });
    void task.promise
      .then((result) => {
        set((state) => {
          if (
            state.project.model.id !== project.model.id ||
            state.project.model.mesh !== sourceMesh ||
            state.project.fabricationMode !== 'stacked-slices' ||
            !settingsMatch(settingsForProject(state.project), settings)
          ) {
            return {
              sliceGenerationStatus: 'stale',
              sliceGenerationError: 'The source or slice settings changed. Generate again.',
            };
          }
          const changed = recordProjectChange(state, (currentProject) => {
            const template = currentProject.sheetLayouts[0];
            return touchProject({
              ...currentProject,
              generatedParts: result.parts,
              generationIssues: result.issues,
              sheetLayouts: template
                ? arrangePartsInRows(result.parts, template)
                : currentProject.sheetLayouts,
            });
          });
          const nextProject = changed.project ?? state.project;
          return {
            ...changed,
            sliceGenerationStatus: 'ready',
            sliceGenerationError: undefined,
            validationIssues: validationIssuesForProject(nextProject),
            selectedEntityId: result.parts[0]?.id,
            activeSheetId: nextProject.sheetLayouts[0]?.id,
            activeWorkflowStep: 'arrange',
          };
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        set({
          sliceGenerationStatus: 'error',
          sliceGenerationError: error instanceof Error ? error.message : 'Slice generation failed.',
        });
      })
      .finally(() => {
        if (activeTask === task) activeTask = undefined;
      });
  },
  generateWaffleSlices: () => {
    const { project } = get();
    if (!project.model.mesh || !project.model.bounds) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: 'This model has no sliceable mesh.',
      });
      return;
    }
    const settings = waffleSettingsForProject(project);
    if (settings.primaryAxis === settings.secondaryAxis) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: 'Choose two different axes for the waffle slice families.',
      });
      return;
    }
    activeTask?.cancel();
    const sourceMesh = project.model.mesh;
    const task = generateWaffleSlicesInWorker({
      mesh: sourceMesh,
      bounds: project.model.bounds,
      modelId: project.model.id,
      settings,
    });
    activeTask = task;
    set({ sliceGenerationStatus: 'processing', sliceGenerationError: undefined });
    void task.promise
      .then((result: WaffleSliceResult) => {
        set((state) => {
          if (
            state.project.model.id !== project.model.id ||
            state.project.model.mesh !== sourceMesh ||
            state.project.fabricationMode !== 'waffle-slices' ||
            !waffleSettingsMatch(waffleSettingsForProject(state.project), settings)
          ) {
            return {
              sliceGenerationStatus: 'stale',
              sliceGenerationError: 'The source or waffle settings changed. Generate again.',
            };
          }
          const changed = recordProjectChange(state, (currentProject) => {
            const template = currentProject.sheetLayouts[0];
            return touchProject({
              ...currentProject,
              generatedParts: result.parts,
              generationIssues: result.issues,
              sheetLayouts: template
                ? arrangePartsInRows(result.parts, template)
                : currentProject.sheetLayouts,
            });
          });
          const nextProject = changed.project ?? state.project;
          return {
            ...changed,
            sliceGenerationStatus: 'ready',
            sliceGenerationError: undefined,
            validationIssues: validationIssuesForProject(nextProject),
            selectedEntityId: result.parts[0]?.id,
            activeSheetId: nextProject.sheetLayouts[0]?.id,
            activeWorkflowStep: 'arrange',
          };
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        set({
          sliceGenerationStatus: 'error',
          sliceGenerationError:
            error instanceof Error ? error.message : 'Waffle generation failed.',
        });
      })
      .finally(() => {
        if (activeTask === task) activeTask = undefined;
      });
  },
  cancelSliceGeneration: () => {
    activeTask?.cancel();
    activeTask = undefined;
    set({
      sliceGenerationStatus: 'cancelled',
      sliceGenerationError: 'Slice generation was cancelled.',
    });
  },
});
