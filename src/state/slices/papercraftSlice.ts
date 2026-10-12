import { acceptedWorkingSource } from '../../geometry/papercraft/workingSource';
import type { AppSliceCreator, PapercraftSlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';
import { papercraftDefaults, type PapercraftResult } from '../../domain/papercraft';
import { hashSerializable, expectedGenerationSignature } from '../../domain/generation';
import { generatePapercraftInWorker, type GeometryTask } from '../../workers/geometryWorkerClient';
import { papercraftInputHash } from '../../geometry/papercraft/inputHash';
import { preservePlacements } from '../../geometry/layout/preservePlacements';
import { validationIssuesForProject } from '../../validation/projectValidation';
import { runtimeFailure } from '../../domain/runtimeFailure';

let active: GeometryTask<PapercraftResult> | undefined;
export function cancelPapercraftTask() {
  active?.cancel();
  active = undefined;
}
export const createPapercraftSlice: AppSliceCreator<PapercraftSlice> = (set, get) => ({
  papercraftCandidate: undefined,
  papercraftProgress: undefined,
  papercraftIssues: [],
  enablePapercraft: () => {
    const mesh = get().project.model.mesh;
    if (!mesh) return;
    get().cancelSliceGeneration();
    set((state) => ({
      ...recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          fabricationMode: 'mesh-unfold',
          papercraft: {
            settings: papercraftDefaults(hashSerializable(mesh)),
            acceptSimplification: false,
          },
        }),
      ),
      papercraftIssues: [],
      sliceGenerationStatus: 'stale',
      sliceGenerationError: undefined,
    }));
  },
  useLegacyUnfolding: () => {
    get().cancelSliceGeneration();
    set((state) => ({
      ...recordProjectChange(state, (project) =>
        touchProject({ ...project, papercraft: undefined }),
      ),
      papercraftIssues: [],
      sliceGenerationStatus: 'stale',
      sliceGenerationError: undefined,
    }));
  },
  updatePapercraftSettings: (patch, acceptSimplification) =>
    set((state) => {
      if (!state.project.papercraft) return state;
      return {
        ...recordProjectChange(state, (project) =>
          touchProject({
            ...project,
            papercraft: {
              ...project.papercraft!,
              settings: { ...project.papercraft!.settings, ...patch },
              acceptSimplification:
                acceptSimplification ?? project.papercraft!.acceptSimplification,
            },
          }),
        ),
        sliceGenerationStatus: 'stale',
      };
    }),
  editPapercraftEdge: (edit) => {
    const project = get().project,
      native = project.papercraft;
    if (!native) return;
    const candidate =
      get().papercraftCandidate?.sourceProject === project ? get().papercraftCandidate : undefined;
    const result = candidate?.result ?? native.result;
    if (result && !result.source.halfEdges.some((e) => e.edgeKey === edit.id)) return;
    set((state) => ({
      ...recordProjectChange(state, (current) =>
        touchProject({
          ...current,
          papercraft: {
            ...current.papercraft!,
            workingSource:
              current.papercraft!.workingSource ??
              (candidate ? acceptedWorkingSource(candidate.input, candidate.result) : undefined),
            settings: {
              ...current.papercraft!.settings,
              edgeEdits: [
                ...current.papercraft!.settings.edgeEdits.filter((e) => e.id !== edit.id),
                edit,
              ].sort((a, b) => a.id.localeCompare(b.id)),
            },
          },
        }),
      ),
      sliceGenerationStatus: 'stale',
      papercraftIssues: [],
    }));
    get().generatePapercraft({ mergeWithInputEdit: true });
  },
  editPapercraftIsland: (edit) =>
    set((state) => {
      const native = state.project.papercraft;
      if (
        !native ||
        !native.result?.islands.some((i) => i.id === edit.id) ||
        !edit.translationMm.every(Number.isFinite) ||
        !Number.isFinite(edit.rotationDeg)
      )
        return state;
      return recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          papercraft: {
            ...project.papercraft!,
            settings: {
              ...native.settings,
              islandEdits: [
                ...native.settings.islandEdits.filter((i) => i.id !== edit.id),
                {
                  ...edit,
                  sourceFaceIds: native.result!.islands.find((i) => i.id === edit.id)!.faceIds,
                },
              ].sort((a, b) => a.id.localeCompare(b.id)),
            },
          },
          sheetLayouts: project.sheetLayouts.map((sheet) => ({
            ...sheet,
            placements: sheet.placements.map((p) =>
              p.partId === edit.id
                ? {
                    ...p,
                    x: edit.translationMm[0],
                    y: edit.translationMm[1],
                    rotationDeg: edit.rotationDeg,
                    layoutLocked: edit.layoutLocked,
                  }
                : p,
            ),
          })),
        }),
      );
    }),
  generatePapercraft: (options) => {
    const project = get().project,
      native = project.papercraft,
      mesh = project.model.mesh;
    if (!native || !mesh) return;
    const input = {
      mesh,
      settings: native.settings,
      materialThicknessMm: project.materialProfileSnapshot.thicknessMm,
      acceptSimplification: native.acceptSimplification,
      workingSource: native.workingSource,
    };
    let expectedHash: string;
    try {
      expectedHash = papercraftInputHash(input);
    } catch (error) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: runtimeFailure(
          'UNFOLD_GENERATION_FAILED',
          error instanceof Error ? error.message : undefined,
        ),
      });
      return;
    }
    get().cancelSliceGeneration();
    const inputHistory = get().past.at(-1),
      task = generatePapercraftInWorker(input, (progress) => {
        if (active === task) set({ papercraftProgress: progress });
      });
    active = task;
    set({
      generationDraft: undefined,
      sliceGenerationStatus: 'processing',
      sliceGenerationError: undefined,
      papercraftIssues: [],
      papercraftProgress: { stage: 'prepared', done: 0, total: 1 },
    });
    void task.promise
      .then((result) => {
        if (active !== task) return;
        set((state) => {
          const current = state.project;
          if (
            current.metadata.id !== project.metadata.id ||
            current.fabricationMode !== 'mesh-unfold' ||
            !current.papercraft ||
            !current.model.mesh ||
            papercraftInputHash({
              mesh: current.model.mesh,
              settings: current.papercraft.settings,
              materialThicknessMm: current.materialProfileSnapshot.thicknessMm,
              acceptSimplification: current.papercraft.acceptSimplification,
              workingSource: current.papercraft.workingSource,
            }) !== expectedHash
          )
            return { sliceGenerationStatus: 'stale', papercraftProgress: undefined };
          const blocking = result.issues.find((i) => i.severity === 'error');
          if (blocking)
            return {
              sliceGenerationStatus: 'error',
              papercraftCandidate: { sourceProject: current, result, input },
              papercraftIssues: result.issues,
              papercraftProgress: undefined,
              sliceGenerationError: runtimeFailure('UNFOLD_GENERATION_FAILED', blocking.message),
            };
          const apply = (value: typeof current) => {
            const workingSource =
              value.papercraft!.workingSource ?? acceptedWorkingSource(input, result);
            const next = { ...value, papercraft: { ...value.papercraft!, workingSource } };
            const committed = structuredClone(result),
              signature = expectedGenerationSignature(next);
            committed.inputHash = signature.inputHash;
            committed.graph.source.inputHash = signature.inputHash;
            committed.unfolding.inputHash = signature.inputHash;
            let layouts = preservePlacements(
              value.sheetLayouts,
              value.generatedParts,
              committed.parts,
            );
            const islandEdits = value.papercraft!.settings.islandEdits.map((edit) => {
              const island =
                committed.islands.find((i) => i.id === edit.id) ??
                committed.islands.find(
                  (i) =>
                    !!edit.sourceFaceIds?.length &&
                    i.faceIds.includes(edit.rootFaceId) &&
                    i.faceIds.filter((id) => edit.sourceFaceIds!.includes(id)).length /
                      Math.max(i.faceIds.length, edit.sourceFaceIds.length) >=
                      0.7,
                );
              return island ? { ...edit, id: island.id, sourceFaceIds: island.faceIds } : edit;
            });
            for (const edit of islandEdits)
              layouts = layouts.map((sheet) => ({
                ...sheet,
                placements: sheet.placements.map((placement) =>
                  placement.partId === edit.id
                    ? {
                        ...placement,
                        x: edit.translationMm[0],
                        y: edit.translationMm[1],
                        rotationDeg: edit.rotationDeg,
                        layoutLocked: edit.layoutLocked,
                      }
                    : placement,
                ),
              }));
            return touchProject({
              ...next,
              papercraft: {
                ...next.papercraft,
                settings: { ...next.papercraft.settings, islandEdits },
                result: committed,
              },
              generatedParts: committed.parts,
              unfoldingResult: committed.unfolding,
              foldingResult: undefined,
              panelConstructionResult: undefined,
              generationIssues: committed.issues,
              generationRecord: {
                ...signature,
                resultHash: hashSerializable(committed),
                algorithmVersion: 'papercraft-v2',
                generatedAt: new Date().toISOString(),
              },
              sheetLayouts: layouts,
            });
          };
          const changed =
              options?.mergeWithInputEdit && inputHistory && state.past.at(-1) === inputHistory
                ? { project: apply(current), future: [], autosaveStatus: 'pending' as const }
                : recordProjectChange(state, apply),
            next = changed.project ?? current;
          const selectedEdge = result.unfolding.edges.find((e) => e.id === state.selectedEntityId);
          return {
            ...changed,
            papercraftCandidate: undefined,
            sliceGenerationStatus: 'ready',
            sliceGenerationError: undefined,
            papercraftIssues: result.issues,
            papercraftProgress: undefined,
            validationIssues: validationIssuesForProject(next),
            activeSheetId: next.sheetLayouts.some(
              (s) => s.id === state.activeSheetId && s.placements.length > 0,
            )
              ? state.activeSheetId
              : (next.sheetLayouts.find((s) => s.placements.length > 0)?.id ??
                next.sheetLayouts[0]?.id),
            selectedEntityId: selectedEdge?.id ?? result.faces[0]?.id,
            selectedPartId: selectedEdge
              ? result.unfolding.faces.find((f) => f.faceIndex === selectedEdge.faceAIndex)?.partId
              : result.parts[0]?.id,
          };
        });
      })
      .catch((error: unknown) => {
        if (active !== task || (error instanceof DOMException && error.name === 'AbortError'))
          return;
        set({
          sliceGenerationStatus: 'error',
          papercraftProgress: undefined,
          sliceGenerationError: runtimeFailure(
            'UNFOLD_GENERATION_FAILED',
            error instanceof Error ? error.message : undefined,
          ),
        });
      })
      .finally(() => {
        if (active === task) active = undefined;
      });
  },
});
