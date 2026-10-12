import type { AppSliceCreator, ExportSlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';
import { validationIssuesForProject } from '../../validation/projectValidation';

export const createExportSlice: AppSliceCreator<ExportSlice> = (set) => ({
  fabricationProfile: 'inspection-svg',
  setFabricationProfile: (fabricationProfile) => set({ fabricationProfile }),
  acknowledgeFabricationWarnings: (ids, accepted) =>
    set((state) =>
      recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          acknowledgedWarningIds: accepted
            ? [...new Set([...project.acknowledgedWarningIds, ...ids])].slice(-200)
            : project.acknowledgedWarningIds.filter((id) => !ids.includes(id)),
        }),
      ),
    ),
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
