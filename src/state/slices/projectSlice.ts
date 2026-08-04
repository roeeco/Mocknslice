import { createProject, prepareProjectForUse } from '../../app/createProject';
import type { AppSliceCreator, ProjectSlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';
import {
  foundationValidationIssues,
  validationIssuesForProject,
} from '../../validation/projectValidation';
import { inferredWorkflowProgress } from '../workflow';
import { deriveGenerationState } from '../../domain/generation';

export const createProjectSlice: AppSliceCreator<ProjectSlice> = (set) => ({
  project: createProject(),
  hasHydrated: false,
  autosaveStatus: 'idle',
  createNewProject: (name) =>
    set(() => {
      const project = createProject(name);
      return {
        project,
        past: [],
        future: [],
        autosaveStatus: 'pending',
        validationIssues: foundationValidationIssues(),
        sliceGenerationStatus: 'idle',
        sliceGenerationError: undefined,
        activeSheetId: project.sheetLayouts[0]?.id,
        activeWorkflowStep: 'start',
        completedWorkflowSteps: [],
      };
    }),
  hydrateProject: (project) =>
    set((state) => {
      const prepared = prepareProjectForUse(project ?? state.project);
      const progress = project
        ? inferredWorkflowProgress(prepared, state.experienceMode)
        : { activeStep: state.activeWorkflowStep, completedSteps: state.completedWorkflowSteps };
      return {
        project: prepared,
        hasHydrated: true,
        past: [],
        future: [],
        autosaveStatus: project ? 'saved' : 'pending',
        validationIssues: validationIssuesForProject(prepared),
        sliceGenerationStatus:
          deriveGenerationState(prepared) === 'ready'
            ? 'ready'
            : deriveGenerationState(prepared) === 'stale'
              ? 'stale'
              : 'idle',
        sliceGenerationError: undefined,
        activeSheetId: prepared.sheetLayouts[0]?.id,
        activeWorkflowStep: progress.activeStep,
        completedWorkflowSteps: progress.completedSteps,
      };
    }),
  renameProject: (name) =>
    set((state) => ({
      ...recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          metadata: { ...project.metadata, name },
        }),
      ),
      completedWorkflowSteps: name.trim() ? state.completedWorkflowSteps : [],
    })),
  replaceProject: (project) =>
    set((state) => {
      const prepared = prepareProjectForUse(project);
      const progress = inferredWorkflowProgress(prepared, state.experienceMode);
      return {
        ...recordProjectChange(state, () => touchProject(prepared)),
        hasHydrated: true,
        validationIssues: validationIssuesForProject(prepared),
        activeWorkflowStep: progress.activeStep,
        completedWorkflowSteps: progress.completedSteps,
        sliceGenerationStatus:
          deriveGenerationState(prepared) === 'ready'
            ? 'ready'
            : deriveGenerationState(prepared) === 'stale'
              ? 'stale'
              : 'idle',
        sliceGenerationError: undefined,
        activeSheetId: prepared.sheetLayouts[0]?.id,
      };
    }),
  setAutosaveStatus: (autosaveStatus) => set({ autosaveStatus }),
});
