import { createMeshValidationIssues } from '../../geometry/mesh/createMeshValidationIssues';
import { rotateModelMesh90, scaleModelMeshToDimension } from '../../geometry/mesh/transformMesh';
import { recordProjectChange, touchProject } from '../projectChange';
import type { AppSliceCreator, ModelSlice } from '../types';
import { runtimeFailure } from '../../domain/runtimeFailure';
import { generationInputChanged } from '../../domain/generationInputs';

function modelName(fileName: string): string {
  return fileName.replace(/\.stl$/i, '') || 'Imported STL';
}

export const createModelSlice: AppSliceCreator<ModelSlice> = (set, get) => ({
  assumedStlUnit: 'millimetres',
  modelImportStatus: 'idle',
  modelImportError: undefined,
  setAssumedStlUnit: (assumedStlUnit) => set({ assumedStlUnit }),
  startModelImport: () => set({ modelImportStatus: 'processing', modelImportError: undefined }),
  completeModelImport: (fileName, result) => {
    get().cancelSliceGeneration();
    if (get().project.papercraft) {
      get().proposePapercraftModelUpdate({
        id: `model-${crypto.randomUUID()}`,
        name: modelName(fileName),
        source: { kind: 'imported', fileName, format: 'stl' },
        transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] },
        mesh: result.mesh,
        bounds: result.bounds,
        dimensions: result.dimensions,
        healthReport: result.healthReport,
        importSettings: result.importSettings,
      });
      return;
    }
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
        selectedPartId: id,
        activeSheetId: state.project.sheetLayouts[0]?.id,
        viewportMode: 'three',
        activeWorkflowStep: 'import',
        completedWorkflowSteps: state.completedWorkflowSteps.filter(
          (step) => step === 'start' || step === 'mode',
        ),
        sliceGenerationStatus: 'idle',
      };
    });
  },
  failModelImport: (modelImportError) => set({ modelImportStatus: 'error', modelImportError }),
  cancelModelImport: () =>
    set({ modelImportStatus: 'cancelled', modelImportError: runtimeFailure('IMPORT_CANCELLED') }),
  rotateModel90: (axis) => {
    get().cancelSliceGeneration();
    if (get().project.papercraft) {
      get().proposePapercraftModelUpdate(rotateModelMesh90(get().project.model, axis));
      return;
    }
    set((state) => {
      const changed = recordProjectChange(state, (project) =>
        touchProject({ ...project, model: rotateModelMesh90(project.model, axis) }),
      );
      const nextProject = changed.project ?? state.project;
      const activeInputChanged = generationInputChanged(state.project, nextProject);
      return {
        ...changed,
        sliceGenerationStatus:
          state.project.generatedParts.length > 0 && activeInputChanged
            ? 'stale'
            : state.sliceGenerationStatus,
        completedWorkflowSteps: activeInputChanged
          ? state.completedWorkflowSteps.filter((step) =>
              ['start', 'mode', 'import'].includes(step),
            )
          : state.completedWorkflowSteps,
      };
    });
  },
  scaleModelToDimension: (axis, targetMm) => {
    get().cancelSliceGeneration();
    if (get().project.papercraft) {
      get().proposePapercraftModelUpdate(
        scaleModelMeshToDimension(get().project.model, axis, targetMm),
      );
      return;
    }
    set((state) => {
      const changed = recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          model: scaleModelMeshToDimension(project.model, axis, targetMm),
        }),
      );
      const nextProject = changed.project ?? state.project;
      const activeInputChanged = generationInputChanged(state.project, nextProject);
      return {
        ...changed,
        sliceGenerationStatus:
          state.project.generatedParts.length > 0 && activeInputChanged
            ? 'stale'
            : state.sliceGenerationStatus,
        completedWorkflowSteps: activeInputChanged
          ? state.completedWorkflowSteps.filter((step) =>
              ['start', 'mode', 'import'].includes(step),
            )
          : state.completedWorkflowSteps,
      };
    });
  },
  scaleModelToLongestDimension: (targetMm) => {
    if (get().project.papercraft) {
      const dimensions = get().project.model.dimensions;
      const axis =
        dimensions.widthMm >= dimensions.heightMm && dimensions.widthMm >= dimensions.depthMm
          ? 'x'
          : dimensions.heightMm >= dimensions.depthMm
            ? 'y'
            : 'z';
      get().scaleModelToDimension(axis, targetMm);
      return;
    }
    get().cancelSliceGeneration();
    set((state) => {
      const dimensions = state.project.model.dimensions;
      const entries = [
        ['x', dimensions.widthMm],
        ['y', dimensions.heightMm],
        ['z', dimensions.depthMm],
      ] as const;
      const [axis] = entries.reduce((largest, entry) => (entry[1] > largest[1] ? entry : largest));
      const changed = recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          model: scaleModelMeshToDimension(project.model, axis, targetMm),
        }),
      );
      const nextProject = changed.project ?? state.project;
      const activeInputChanged = generationInputChanged(state.project, nextProject);
      return {
        ...changed,
        sliceGenerationStatus:
          state.project.generatedParts.length > 0 && activeInputChanged
            ? 'stale'
            : state.sliceGenerationStatus,
        completedWorkflowSteps: activeInputChanged
          ? state.completedWorkflowSteps.filter((step) =>
              ['start', 'mode', 'import'].includes(step),
            )
          : state.completedWorkflowSteps,
      };
    });
  },
});
