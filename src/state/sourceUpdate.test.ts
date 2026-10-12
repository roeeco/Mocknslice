import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Workers from '../workers/geometryWorkerClient';
import type {
  PapercraftKernelInput,
  PreparedPapercraftSource,
  PapercraftResult,
} from '../domain/papercraft';
import { createProject } from '../app/createProject';
import { generatePapercraft } from '../geometry/papercraft/buildFabrication';
import { preparePapercraftSource } from '../geometry/papercraft/prepareSource';
import { scaleModelMeshToDimension } from '../geometry/mesh/transformMesh';
import { serializeProject } from '../exporters/exportProject';
import { parseProjectFile } from '../exporters/importProject';
import { evaluateExportReadiness } from '../geometry/output/evaluateExportReadiness';
import { deriveGenerationState } from '../domain/generation';
import { subdividedCube } from '../test-fixtures/papercraftSources';
const workers = vi.hoisted(() => ({
  generatePapercraftInWorker: vi.fn(),
  preparePapercraftSourceInWorker: vi.fn(),
}));
vi.mock('../workers/geometryWorkerClient', async (importOriginal) => ({
  ...(await importOriginal<typeof Workers>()),
  ...workers,
}));
import { useProjectStore as store } from './useProjectStore';
beforeEach(() => {
  store.getState().cancelSliceGeneration();
  store.setState({
    project: createProject('Source review'),
    past: [],
    future: [],
    pendingModelUpdate: undefined,
    papercraftCandidate: undefined,
    papercraftIssues: [],
    sliceGenerationStatus: 'idle',
  });
  workers.generatePapercraftInWorker.mockImplementation((input: PapercraftKernelInput) => ({
    promise: Promise.resolve(generatePapercraft(input)),
    cancel: vi.fn(),
  }));
  workers.preparePapercraftSourceInWorker.mockImplementation((input: PapercraftKernelInput) => ({
    promise: Promise.resolve(preparePapercraftSource(input)),
    cancel: vi.fn(),
  }));
});
async function ready() {
  store.getState().enablePapercraft();
  store.getState().generatePapercraft({ mergeWithInputEdit: true });
  await vi.waitFor(() => expect(store.getState().sliceGenerationStatus).toBe('ready'));
}
describe('source replacement confirmation and durable edits', () => {
  it('keeps the prior source until acceptance, saves unmatched edits, and restores the complete source with undo', async () => {
    await ready();
    const initial = store.getState().project,
      key = initial.papercraft!.result!.tabs[0]!.edgeKey;
    store.getState().editPapercraftEdge({
      id: key,
      intent: 'auto',
      tab: { owner: 'none', targetDepthMm: 6, shoulderAngleDeg: 45 },
    });
    await vi.waitFor(() => expect(store.getState().sliceGenerationStatus).toBe('ready'));
    const island = store.getState().project.papercraft!.result!.islands[0]!;
    store.getState().editPapercraftIsland({
      id: island.id,
      rootFaceId: island.rootFaceId,
      translationMm: [45, 50],
      rotationDeg: 37,
      layoutLocked: true,
    });
    const original = store.getState().project,
      newModel = scaleModelMeshToDimension(original.model, 'x', 42),
      past = store.getState().past.length;
    store.getState().proposePapercraftModelUpdate(newModel);
    await vi.waitFor(() => expect(store.getState().pendingModelUpdate).toBeDefined());
    expect(store.getState().project).toBe(original);
    expect(store.getState().pendingModelUpdate!.proposal.unresolvedEdits).toHaveLength(2);
    store.getState().cancelPapercraftModelUpdate();
    expect(store.getState().project).toBe(original);
    expect(store.getState().past).toHaveLength(past);
    store.getState().proposePapercraftModelUpdate(newModel);
    await vi.waitFor(() => expect(store.getState().pendingModelUpdate).toBeDefined());
    store.getState().acceptPapercraftModelUpdate();
    await vi.waitFor(() => expect(store.getState().sliceGenerationStatus).toBe('ready'));
    const accepted = store.getState().project;
    expect(accepted.model.dimensions.widthMm).toBe(42);
    expect(accepted.unresolvedEdits).toHaveLength(2);
    expect(store.getState().past).toHaveLength(past + 1);
    expect(accepted.sheetLayouts.flatMap((s) => s.placements).some((p) => p.layoutLocked)).toBe(
      false,
    );
    expect(
      evaluateExportReadiness(accepted).blockingIssues.some(
        (i) => i.code === 'SOURCE_EDITS_UNRESOLVED',
      ),
    ).toBe(true);
    expect(parseProjectFile(serializeProject(accepted)).unresolvedEdits).toEqual(
      accepted.unresolvedEdits,
    );
    store.getState().undo();
    expect(store.getState().project).toBe(original);
    store.getState().redo();
    expect(store.getState().project.model.mesh).toEqual(newModel.mesh);
    const edgeEdit = store.getState().project.unresolvedEdits!.find((e) => e.kind === 'edge')!,
      target = store.getState().project.papercraft!.result!.tabs[0]!.edgeKey;
    store.getState().resolvePapercraftEdit(edgeEdit.id, target);
    await vi.waitFor(() => expect(store.getState().sliceGenerationStatus).toBe('ready'));
    expect(store.getState().project.papercraft!.settings.edgeEdits[0]!.id).toBe(target);
    for (const unresolved of store.getState().project.unresolvedEdits ?? [])
      store.getState().resolvePapercraftEdit(unresolved.id);
    expect(store.getState().project.unresolvedEdits).toEqual([]);
    expect(deriveGenerationState(store.getState().project)).toBe('ready');
    expect(
      evaluateExportReadiness(store.getState().project).blockingIssues.some(
        (i) => i.code === 'SOURCE_EDITS_UNRESOLVED',
      ),
    ).toBe(false);
  });
  it('keeps accepted simplification editable even when an unresolved tab initially blocks fabrication', async () => {
    const project = createProject('Accepted mesh'),
      mesh = subdividedCube();
    project.model.mesh = mesh;
    store.setState({ project });
    store.getState().enablePapercraft();
    store.getState().updatePapercraftSettings({ faceTarget: 150, maxCandidates: 1 }, true);
    store.getState().generatePapercraft();
    await vi.waitFor(() => expect(store.getState().sliceGenerationStatus).toBe('error'));
    const candidate = store.getState().papercraftCandidate!,
      keys = candidate.result.tabs.filter((t) => t.status === 'unresolved').map((t) => t.edgeKey);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      store.getState().editPapercraftEdge({
        id: key,
        intent: 'auto',
        tab: { owner: 'none', targetDepthMm: 6, shoulderAngleDeg: 45 },
      });
      await vi.waitFor(() => expect(store.getState().sliceGenerationStatus).not.toBe('processing'));
    }
    expect(store.getState().sliceGenerationStatus).toBe('ready');
    expect(store.getState().project.model.mesh).toEqual(mesh);
    expect(store.getState().project.papercraft!.workingSource?.mesh.indices).toHaveLength(450);
    expect(deriveGenerationState(store.getState().project)).toBe('ready');
    const restored = parseProjectFile(serializeProject(store.getState().project));
    expect(restored.papercraft?.workingSource).toEqual(
      store.getState().project.papercraft!.workingSource,
    );
    expect(deriveGenerationState(restored)).toBe('ready');
  });
  it('cancels preparation and rejects late results after undo or project replacement', async () => {
    await ready();
    let finish: ((source: PreparedPapercraftSource) => void) | undefined;
    const cancel = vi.fn();
    workers.preparePapercraftSourceInWorker.mockImplementation(() => ({
      promise: new Promise<PreparedPapercraftSource>((resolve) => {
        finish = resolve;
      }),
      cancel,
    }));
    const project = store.getState().project;
    store.getState().proposePapercraftModelUpdate(project.model);
    store.getState().renameProject('Changed');
    store.getState().undo();
    finish?.(
      preparePapercraftSource({
        mesh: project.model.mesh!,
        settings: project.papercraft!.settings,
        materialThicknessMm: 0.35,
      }),
    );
    await Promise.resolve();
    expect(cancel).toHaveBeenCalled();
    expect(store.getState().pendingModelUpdate).toBeUndefined();
    let finishNet: ((result: PapercraftResult) => void) | undefined;
    workers.generatePapercraftInWorker.mockImplementation(() => ({
      promise: new Promise<PapercraftResult>((resolve) => {
        finishNet = resolve;
      }),
      cancel,
    }));
    store.getState().generatePapercraft();
    store.getState().replaceProject(createProject('Replacement'));
    finishNet?.(
      generatePapercraft({
        mesh: project.model.mesh!,
        settings: project.papercraft!.settings,
        materialThicknessMm: project.materialProfileSnapshot.thicknessMm,
      }),
    );
    await Promise.resolve();
    expect(store.getState().project.metadata.name).toBe('Replacement');
    expect(store.getState().project.generatedParts).toEqual([]);
  });
});
