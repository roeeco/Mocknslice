import type { StlUnit } from '../domain/model';
import type { NormalizedMeshResult } from '../geometry/mesh/normalizeMesh';
import type { GeometryWorkerRequest, GeometryWorkerResponse } from './protocol';

export interface GeometryTask<T> {
  promise: Promise<T>;
  cancel: () => void;
}

export function normalizeStlInWorker(
  arrayBuffer: ArrayBuffer,
  assumedUnit: StlUnit,
): GeometryTask<NormalizedMeshResult> {
  const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
  const id = crypto.randomUUID();
  let settled = false;
  let rejectTask: ((reason?: unknown) => void) | undefined;

  const promise = new Promise<NormalizedMeshResult>((resolve, reject) => {
    rejectTask = reject;
    worker.onmessage = (event: MessageEvent<GeometryWorkerResponse>) => {
      if (event.data.id !== id || settled) return;
      settled = true;
      worker.terminate();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    worker.onerror = () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(new Error('The geometry worker stopped unexpectedly.'));
    };
  });

  const request: GeometryWorkerRequest = {
    id,
    type: 'normalize-stl',
    payload: { arrayBuffer, assumedUnit },
  };
  worker.postMessage(request, [arrayBuffer]);

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      rejectTask?.(new DOMException('STL import was cancelled.', 'AbortError'));
    },
  };
}
