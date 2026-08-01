import { DEFAULT_MATERIALS, getDefaultMaterial } from '../../materials/defaultMaterials';
import type { AppSliceCreator, MaterialLibrarySlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';

export const createMaterialLibrarySlice: AppSliceCreator<MaterialLibrarySlice> = (set) => ({
  materials: DEFAULT_MATERIALS,
  selectMaterial: (id) =>
    set((state) => {
      const material = getDefaultMaterial(id);
      const changed = recordProjectChange(state, (project) => {
        const previous = project.materialProfileSnapshot;
        const parameters = { ...project.modeParameters };
        if (parameters.sliceThicknessMm === previous.thicknessMm)
          parameters.sliceThicknessMm = material.thicknessMm;
        if (parameters.waffleThicknessMm === previous.thicknessMm)
          parameters.waffleThicknessMm = material.thicknessMm;
        if (parameters.waffleClearanceMm === previous.clearanceMm)
          parameters.waffleClearanceMm = material.clearanceMm;
        if (parameters.foldClearanceMm === previous.clearanceMm)
          parameters.foldClearanceMm = material.clearanceMm;
        return touchProject({
          ...project,
          modeParameters: parameters,
          materialProfileSnapshot: material,
          exportSettings: {
            ...project.exportSettings,
            customKerfMm:
              project.exportSettings.customKerfMm === previous.kerfMm
                ? material.kerfMm
                : project.exportSettings.customKerfMm,
          },
        });
      });
      return {
        ...changed,
        sliceGenerationStatus:
          state.project.generatedParts.length > 0 ? 'stale' : state.sliceGenerationStatus,
      };
    }),
});
