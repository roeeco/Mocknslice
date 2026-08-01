import { DEFAULT_MATERIALS, getDefaultMaterial } from '../../materials/defaultMaterials';
import type { AppSliceCreator, MaterialLibrarySlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';

export const createMaterialLibrarySlice: AppSliceCreator<MaterialLibrarySlice> = (set) => ({
  materials: DEFAULT_MATERIALS,
  selectMaterial: (id) =>
    set((state) =>
      recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          materialProfileSnapshot: getDefaultMaterial(id),
        }),
      ),
    ),
});
