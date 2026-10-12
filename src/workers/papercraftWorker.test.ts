import { afterEach, describe, expect, it, vi } from 'vitest';
import { generatePapercraftInWorker } from './geometryWorkerClient';
import { createCubeMesh } from '../geometry/mesh/createPrimitiveMesh';
import { hashSerializable } from '../domain/canonicalHash';
import { papercraftDefaults } from '../domain/papercraft';
import { generatePapercraft } from '../geometry/papercraft/buildFabrication';

class MockWorker {
  static instances: MockWorker[] = [];
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    MockWorker.instances.push(this);
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  MockWorker.instances = [];
});
describe('papercraft worker lifecycle', () => {
  const mesh = createCubeMesh(20).mesh,
    input = { mesh, materialThicknessMm: 1, settings: papercraftDefaults(hashSerializable(mesh)) };
  it('keeps progress separate from result and ignores wrong task IDs', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const progress = vi.fn(),
      task = generatePapercraftInWorker(input, progress),
      worker = MockWorker.instances[0]!,
      id = worker.postMessage.mock.calls[0]![0].id;
    worker.onmessage?.({
      data: {
        id: 'other',
        type: 'papercraft-progress',
        progress: { stage: 'prepared', done: 1, total: 1 },
      },
    });
    expect(progress).not.toHaveBeenCalled();
    worker.onmessage?.({
      data: { id, type: 'papercraft-progress', progress: { stage: 'prepared', done: 1, total: 1 } },
    });
    expect(progress).toHaveBeenCalledOnce();
    expect(worker.terminate).not.toHaveBeenCalled();
    const result = generatePapercraft(input);
    worker.onmessage?.({ data: { id, type: 'generate-papercraft', ok: true, result } });
    expect(await task.promise).toEqual(result);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('cancels immediately and rejects a stale input hash', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const cancelled = generatePapercraftInWorker(input),
      cancelExpectation = expect(cancelled.promise).rejects.toMatchObject({ name: 'AbortError' });
    cancelled.cancel();
    cancelled.cancel();
    await cancelExpectation;
    expect(MockWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
    const stale = generatePapercraftInWorker(input),
      worker = MockWorker.instances[1]!,
      id = worker.postMessage.mock.calls[0]![0].id;
    const staleExpectation = expect(stale.promise).rejects.toThrow('mismatched');
    worker.onmessage?.({
      data: { id, type: 'generate-papercraft', ok: true, result: { inputHash: 'stale' } },
    });
    await staleExpectation;
  });
});
