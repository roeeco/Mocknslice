import type { AppSliceCreator, ExportSlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';

export const createExportSlice: AppSliceCreator<ExportSlice> = (set) => ({
  updateExportSettings: (settings) =>
    set((state) =>
      recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          exportSettings: { ...project.exportSettings, ...settings },
        }),
      ),
    ),
});
