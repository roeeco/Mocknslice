import type { ProjectData } from '../domain/project';
import type { AppState } from './types';

const HISTORY_LIMIT = 50;

export function recordProjectChange(
  state: AppState,
  update: (project: ProjectData) => ProjectData,
): Partial<AppState> {
  return {
    project: update(state.project),
    past: [...state.past, state.project].slice(-HISTORY_LIMIT),
    future: [],
    autosaveStatus: 'pending',
  };
}

export function touchProject(project: ProjectData): ProjectData {
  return {
    ...project,
    metadata: {
      ...project.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
}
