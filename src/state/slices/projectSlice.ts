import { createProject } from '../../app/createProject';
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
    }),
  hydrateProject: (project) =>
    set((state) => ({
      project: project ?? state.project,
      hasHydrated: true,
      past: [],
      future: [],
      autosaveStatus: project ? 'saved' : 'pending',
      validationIssues: project
        ? validationIssuesForProject(project)
        : validationIssuesForProject(state.project),
    })),
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
    set((state) => ({
      ...recordProjectChange(state, () => touchProject(project)),
      hasHydrated: true,
      validationIssues: validationIssuesForProject(project),
      activeWorkflowStep: project.model.source.kind === 'imported' ? 'inspect' : 'start',
    })),
  setAutosaveStatus: (autosaveStatus) => set({ autosaveStatus }),
});
