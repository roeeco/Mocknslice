import { createMeshValidationIssues } from '../../geometry/mesh/createMeshValidationIssues';
import { rotateModelMesh90, scaleModelMeshToDimension } from '../../geometry/mesh/transformMesh';
import { recordProjectChange, touchProject } from '../projectChange';
import type { AppSliceCreator, ModelSlice } from '../types';

function modelName(fileName: string): string {
  return fileName.replace(/\.stl$/i, '') || 'Imported STL';
}

export const createModelSlice: AppSliceCreator<ModelSlice> = (set) => ({
  assumedStlUnit: 'millimetres',
  modelImportStatus: 'idle',
  modelImportError: undefined,
  setAssumedStlUnit: (assumedStlUnit) => set({ assumedStlUnit }),
  startModelImport: () => set({ modelImportStatus: 'processing', modelImportError: undefined }),
  completeModelImport: (fileName, result) =>
    set((state) => {
      const id = `model-${crypto.randomUUID()}`;
      return {
        ...recordProjectChange(state, (project) =>
          touchProject({
            ...project,
            generatedParts: [],
            generationIssues: [],
            foldingResult: undefined,
            unfoldingResult: undefined,
            panelConstructionResult: undefined,
            sheetLayouts: project.sheetLayouts.map((sheet) => ({ ...sheet, placements: [] })),
            model: {
              id,
              name: modelName(fileName),
              source: { kind: 'imported', fileName, format: 'stl' },
              transform: {
                positionMm: [0, 0, 0],
                rotationDeg: [0, 0, 0],
                scale: [1, 1, 1],
              },
              mesh: result.mesh,
              bounds: result.bounds,
              dimensions: result.dimensions,
              healthReport: result.healthReport,
              importSettings: result.importSettings,
            },
          }),
        ),
        modelImportStatus: 'ready',
        modelImportError: undefined,
        validationIssues: createMeshValidationIssues(
          result.healthReport,
          result.importSettings,
          id,
        ),
        selectedEntityId: id,
        activeSheetId: state.project.sheetLayouts[0]?.id,
        viewportMode: 'three',
        activeWorkflowStep: 'inspect',
        sliceGenerationStatus: 'idle',
      };
    }),
  failModelImport: (modelImportError) => set({ modelImportStatus: 'error', modelImportError }),
  cancelModelImport: () =>
    set({ modelImportStatus: 'cancelled', modelImportError: 'STL import was cancelled.' }),
  rotateModel90: (axis) =>
    set((state) => ({
      ...recordProjectChange(state, (project) =>
        touchProject({ ...project, model: rotateModelMesh90(project.model, axis) }),
      ),
      sliceGenerationStatus: state.project.generatedParts.length > 0 ? 'stale' : 'idle',
    })),
  scaleModelToDimension: (axis, targetMm) =>
    set((state) => ({
      ...recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          model: scaleModelMeshToDimension(project.model, axis, targetMm),
        }),
      ),
      sliceGenerationStatus: state.project.generatedParts.length > 0 ? 'stale' : 'idle',
    })),
});
