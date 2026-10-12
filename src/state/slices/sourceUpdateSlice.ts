import type { AppSliceCreator, SourceUpdateSlice } from '../types';
import type {
  PreparedPapercraftSource,
  PapercraftEdgeEdit,
  PapercraftIslandEdit,
} from '../../domain/papercraft';
import {
  preparePapercraftSourceInWorker,
  type GeometryTask,
} from '../../workers/geometryWorkerClient';
import { relinkOnModelUpdate } from '../../geometry/papercraft/relinkOnModelUpdate';
import { acceptedWorkingSource } from '../../geometry/papercraft/workingSource';
import { hashSerializable, deriveGenerationState } from '../../domain/generation';
import { recordProjectChange, touchProject } from '../projectChange';
import { validationIssuesForProject } from '../../validation/projectValidation';
import { runtimeFailure } from '../../domain/runtimeFailure';
let preparation: GeometryTask<PreparedPapercraftSource> | undefined;
export function cancelSourcePreparationTask() {
  preparation?.cancel();
  preparation = undefined;
}
export const createSourceUpdateSlice: AppSliceCreator<SourceUpdateSlice> = (set, get) => ({
  pendingModelUpdate: undefined,
  proposePapercraftModelUpdate: (model) => {
    const project = get().project,
      native = project.papercraft;
    if (!native || !model.mesh) return;
    get().cancelSliceGeneration();
    const settings = { ...native.settings, sourceMeshHash: hashSerializable(model.mesh) };
    const input = {
      mesh: model.mesh,
      settings: { ...settings, edgeEdits: [], islandEdits: [] },
      materialThicknessMm: project.materialProfileSnapshot.thicknessMm,
      acceptSimplification: native.acceptSimplification,
    };
    const task = preparePapercraftSourceInWorker(input);
    preparation = task;
    set({
      pendingModelUpdate: undefined,
      sliceGenerationStatus: 'processing',
      sliceGenerationError: undefined,
    });
    void task.promise
      .then((source) => {
        if (preparation !== task || get().project !== project) return;
        if (source.sourceMeshHash !== settings.sourceMeshHash)
          throw new Error('Source preparation returned a mismatched mesh.');
        const oldMesh =
          native.workingSource?.mesh ?? native.result?.source.mesh ?? project.model.mesh!;
        const proposal = relinkOnModelUpdate(oldMesh, source.mesh, native.settings, native.result);
        proposal.sourceMeshHash = settings.sourceMeshHash;
        proposal.issues = [...proposal.issues, ...source.issues];
        const workingSource = acceptedWorkingSource(input, { source });
        set({
          pendingModelUpdate: {
            originalProject: project,
            model,
            settings,
            workingSource,
            proposal,
          },
          sliceGenerationStatus: deriveGenerationState(project) === 'ready' ? 'ready' : 'stale',
          modelImportStatus: 'ready',
        });
      })
      .catch((error: unknown) => {
        if (preparation !== task || (error instanceof DOMException && error.name === 'AbortError'))
          return;
        set({
          sliceGenerationStatus: 'error',
          sliceGenerationError: runtimeFailure(
            'UNFOLD_GENERATION_FAILED',
            error instanceof Error ? error.message : undefined,
          ),
        });
      })
      .finally(() => {
        if (preparation === task) preparation = undefined;
      });
  },
  cancelPapercraftModelUpdate: () => {
    cancelSourcePreparationTask();
    set((state) => ({
      pendingModelUpdate: undefined,
      modelImportStatus: state.project.model.source.kind === 'imported' ? 'ready' : 'idle',
      sliceGenerationStatus: deriveGenerationState(state.project) === 'ready' ? 'ready' : 'stale',
      sliceGenerationError: undefined,
    }));
  },
  acceptPapercraftModelUpdate: () => {
    const pending = get().pendingModelUpdate;
    if (
      !pending ||
      pending.originalProject !== get().project ||
      pending.proposal.issues.some((i) => i.severity === 'error')
    )
      return;
    get().cancelSliceGeneration();
    set((state) => {
      const changed = recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          model: pending.model,
          papercraft: {
            ...project.papercraft!,
            workingSource: pending.workingSource,
            settings: {
              ...pending.settings,
              edgeEdits: pending.proposal.edgeEdits,
              islandEdits: pending.proposal.islandEdits,
            },
          },
          unresolvedEdits: [
            ...(project.unresolvedEdits ?? []),
            ...pending.proposal.unresolvedEdits,
          ],
          acknowledgedWarningIds: [],
        }),
      );
      return {
        ...changed,
        pendingModelUpdate: undefined,
        sliceGenerationStatus: 'stale',
        modelImportStatus: 'ready',
        validationIssues: validationIssuesForProject(changed.project ?? state.project),
      };
    });
    if (get().project.fabricationMode === 'mesh-unfold')
      get().generatePapercraft({ mergeWithInputEdit: true });
  },
  resolvePapercraftEdit: (id, targetId) => {
    const project = get().project,
      unresolved = project.unresolvedEdits?.find((e) => e.id === id),
      native = project.papercraft;
    if (!unresolved || !native) return;
    if (
      targetId &&
      unresolved.kind === 'edge' &&
      (!native.result?.source.halfEdges.some((e) => e.edgeKey === targetId) ||
        native.settings.edgeEdits.some((e) => e.id === targetId))
    )
      return;
    if (
      targetId &&
      unresolved.kind === 'island' &&
      !native.result?.islands.some((i) => i.id === targetId)
    )
      return;
    get().cancelSliceGeneration();
    set((state) =>
      recordProjectChange(state, (current) => {
        const settings = structuredClone(current.papercraft!.settings);
        if (targetId && unresolved.kind === 'edge')
          settings.edgeEdits.push({ ...(unresolved.edit as PapercraftEdgeEdit), id: targetId });
        if (targetId && unresolved.kind === 'island') {
          const island = native.result!.islands.find((i) => i.id === targetId)!;
          settings.islandEdits.push({
            ...(unresolved.edit as PapercraftIslandEdit),
            id: targetId,
            rootFaceId: island.rootFaceId,
            sourceFaceIds: island.faceIds,
          });
        }
        return touchProject({
          ...current,
          papercraft: { ...current.papercraft!, settings },
          unresolvedEdits: current.unresolvedEdits!.filter((e) => e.id !== id),
        });
      }),
    );
    if (targetId) get().generatePapercraft({ mergeWithInputEdit: true });
    else
      set((state) => ({
        sliceGenerationStatus: deriveGenerationState(state.project) === 'ready' ? 'ready' : 'stale',
        sliceGenerationError: undefined,
      }));
  },
});
