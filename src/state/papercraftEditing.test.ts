import type * as GeometryWorkers from '../workers/geometryWorkerClient';
import type { PapercraftKernelInput } from '../domain/papercraft';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '../app/createProject';
import { generatePapercraft } from '../geometry/papercraft/buildFabrication';
import { deriveGenerationState } from '../domain/generation';
const workers = vi.hoisted(() => ({ generatePapercraftInWorker: vi.fn() }));
vi.mock('../workers/geometryWorkerClient', async (importOriginal) => ({
  ...(await importOriginal<typeof GeometryWorkers>()),
  ...workers,
}));
import { useProjectStore } from './useProjectStore';

beforeEach(() => {
  useProjectStore.getState().cancelSliceGeneration();
  useProjectStore.setState({
    project: createProject(),
    past: [],
    future: [],
    papercraftIssues: [],
    sliceGenerationStatus: 'idle',
  });
  workers.generatePapercraftInWorker.mockImplementation((input: PapercraftKernelInput) => ({
    promise: Promise.resolve(generatePapercraft(input)),
    cancel: vi.fn(),
  }));
});
describe('papercraft edit transactions', () => {
  it('merges successful edit and regeneration into one undoable action', async () => {
    const store = useProjectStore;
    store.getState().enablePapercraft();
    store.getState().generatePapercraft({ mergeWithInputEdit: true });
    await vi.waitFor(() => expect(store.getState().sliceGenerationStatus).toBe('ready'));
    const original = store.getState().project,
      key = original.papercraft!.result!.tabs[0]!.edgeKey,
      past = store.getState().past.length;
    store.getState().selectEntity(`edge-${key}`);
    store.getState().editPapercraftEdge({
      id: key,
      intent: 'must-cut',
      tab: { owner: 'none', targetDepthMm: 6, shoulderAngleDeg: 45 },
    });
    await vi.waitFor(() => expect(store.getState().sliceGenerationStatus).toBe('ready'));
    expect(store.getState().past).toHaveLength(past + 1);
    expect(store.getState().selectedEntityId).toBe(`edge-${key}`);
    store.getState().undo();
    expect(store.getState().project.papercraft!.settings.edgeEdits).toEqual(
      original.papercraft!.settings.edgeEdits,
    );
    expect(deriveGenerationState(store.getState().project)).toBe('ready');
    store.getState().redo();
    expect(store.getState().project.papercraft!.settings.edgeEdits[0]!.tab.owner).toBe('none');
  });
  it('retains last valid artifacts for a hard constraint failure and discards cancelled output', async () => {
    const store = useProjectStore;
    store.getState().enablePapercraft();
    store.getState().generatePapercraft();
    await vi.waitFor(() => expect(store.getState().sliceGenerationStatus).toBe('ready'));
    const original = store.getState().project;
    workers.generatePapercraftInWorker.mockImplementation((input: PapercraftKernelInput) => ({
      promise: Promise.resolve({
        ...generatePapercraft(input),
        issues: [
          {
            id: 'bad',
            code: 'PAPERCRAFT_FORCED_JOIN_COLLISION',
            severity: 'error',
            message: 'Join collides.',
            affectedEntityIds: ['0:1'],
          },
        ],
      }),
      cancel: vi.fn(),
    }));
    store.getState().editPapercraftEdge({
      id: original.papercraft!.result!.tabs[0]!.edgeKey,
      intent: 'must-join',
      tab: { owner: 'face-a', targetDepthMm: 6, shoulderAngleDeg: 45 },
    });
    await vi.waitFor(() => expect(store.getState().sliceGenerationStatus).toBe('error'));
    expect(store.getState().project.generatedParts).toBe(original.generatedParts);
    expect(store.getState().project.papercraft!.result).toBe(original.papercraft!.result);
    expect(deriveGenerationState(store.getState().project)).toBe('stale');
    let resolve: (value: unknown) => void = () => {};
    const cancel = vi.fn();
    workers.generatePapercraftInWorker.mockReturnValue({
      promise: new Promise((r) => {
        resolve = r;
      }),
      cancel,
    });
    store.getState().generatePapercraft();
    store.getState().cancelSliceGeneration();
    resolve(original.papercraft!.result);
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledOnce();
    expect(store.getState().sliceGenerationStatus).toBe('cancelled');
    expect(store.getState().project.generatedParts).toBe(original.generatedParts);
  });
});
