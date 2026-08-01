import { createProject } from '../../app/createProject';
import type { AppSliceCreator, ProjectSlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';

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
    }),
  hydrateProject: (project) =>
    set((state) => ({
      project: project ?? state.project,
      hasHydrated: true,
      past: [],
      future: [],
      autosaveStatus: project ? 'saved' : 'pending',
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
    })),
  setAutosaveStatus: (autosaveStatus) => set({ autosaveStatus }),
});
