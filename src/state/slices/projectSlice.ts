import { createProject, prepareProjectForUse } from '../../app/createProject';
import type { AppSliceCreator, ProjectSlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';
import {
  foundationValidationIssues,
  validationIssuesForProject,
} from '../../validation/projectValidation';

export const createProjectSlice: AppSliceCreator<ProjectSlice> = (set) => ({
  project: createProject(),
  hasHydrated: false,
  autosaveStatus: 'idle',
  createNewProject: (name) =>
    set({
      project: createProject(name),
      past: [],
      future: [],
      autosaveStatus: 'pending',
      validationIssues: foundationValidationIssues(),
      sliceGenerationStatus: 'idle',
      sliceGenerationError: undefined,
    }),
  hydrateProject: (project) =>
    set((state) => {
      const prepared = prepareProjectForUse(project ?? state.project);
      return {
        project: prepared,
        hasHydrated: true,
        past: [],
        future: [],
        autosaveStatus: project ? 'saved' : 'pending',
        validationIssues: validationIssuesForProject(prepared),
        sliceGenerationStatus: prepared.generatedParts.length > 0 ? 'ready' : 'idle',
        sliceGenerationError: undefined,
      };
    }),
  renameProject: (name) =>
    set((state) =>
      recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          metadata: { ...project.metadata, name },
        }),
      ),
    ),
  replaceProject: (project) =>
    set((state) => {
      const prepared = prepareProjectForUse(project);
      return {
        ...recordProjectChange(state, () => touchProject(prepared)),
        hasHydrated: true,
        validationIssues: validationIssuesForProject(prepared),
        activeWorkflowStep: prepared.model.source.kind === 'imported' ? 'inspect' : 'start',
        sliceGenerationStatus: prepared.generatedParts.length > 0 ? 'ready' : 'idle',
        sliceGenerationError: undefined,
      };
    }),
  setAutosaveStatus: (autosaveStatus) => set({ autosaveStatus }),
});
