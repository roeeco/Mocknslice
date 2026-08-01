import type { AppSliceCreator, ExportSlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';
import { validationIssuesForProject } from '../../validation/projectValidation';

export const createExportSlice: AppSliceCreator<ExportSlice> = (set) => ({
  updateExportSettings: (settings) =>
    set((state) => {
      const changed = recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          exportSettings: { ...project.exportSettings, ...settings },
        }),
      );
      return {
        ...changed,
        validationIssues: validationIssuesForProject(changed.project ?? state.project),
      };
    }),
});
