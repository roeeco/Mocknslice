import type { AppSliceCreator, FabricationSlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';

export const createFabricationSlice: AppSliceCreator<FabricationSlice> = (set) => ({
  setFabricationMode: (fabricationMode) =>
    set((state) =>
      recordProjectChange(state, (project) => touchProject({ ...project, fabricationMode })),
    ),
  setModeParameter: (name, value) =>
    set((state) =>
      recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          modeParameters: { ...project.modeParameters, [name]: value },
        }),
      ),
    ),
});
