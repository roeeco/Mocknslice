import type { StlUnit } from '../domain/model';
import type { NormalizedMeshResult } from '../geometry/mesh/normalizeMesh';
import type {
  StackedSliceInput,
  StackedSliceResult,
  WaffleSliceInput,
  WaffleSliceResult,
} from '../geometry/slicing/types';
import type { GeometryWorkerRequest, GeometryWorkerResponse } from './protocol';
import type { TemplateGenerationResult } from '../domain/folding';
import type { FoldTemplateInput } from '../geometry/folding/generateFoldTemplate';
import type { MeshUnfoldResult } from '../domain/unfolding';
import type { MeshUnfoldInput } from '../geometry/unfolding/generateMeshUnfold';
import type { PanelConstructionResult } from '../domain/panelConstruction';
import type { PanelConstructionInput } from '../geometry/panelConstruction/generatePanelConstruction';

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
      if (event.data.ok && event.data.type === 'normalize-stl') resolve(event.data.result);
      else if (event.data.ok) reject(new Error('The geometry worker returned the wrong result.'));
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

export function generateStackedSlicesInWorker(
  input: StackedSliceInput,
): GeometryTask<StackedSliceResult> {
  const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
  const id = crypto.randomUUID();
  let settled = false;
  let rejectTask: ((reason?: unknown) => void) | undefined;

  const promise = new Promise<StackedSliceResult>((resolve, reject) => {
    rejectTask = reject;
    worker.onmessage = (event: MessageEvent<GeometryWorkerResponse>) => {
      if (event.data.id !== id || settled) return;
      settled = true;
      worker.terminate();
      if (event.data.ok && event.data.type === 'generate-stacked-slices')
        resolve(event.data.result);
      else if (event.data.ok) reject(new Error('The geometry worker returned the wrong result.'));
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
    type: 'generate-stacked-slices',
    payload: input,
  };
  worker.postMessage(request);

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      rejectTask?.(new DOMException('Slice generation was cancelled.', 'AbortError'));
    },
  };
}

export function generateWaffleSlicesInWorker(
  input: WaffleSliceInput,
): GeometryTask<WaffleSliceResult> {
  const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
  const id = crypto.randomUUID();
  let settled = false;
  let rejectTask: ((reason?: unknown) => void) | undefined;

  const promise = new Promise<WaffleSliceResult>((resolve, reject) => {
    rejectTask = reject;
    worker.onmessage = (event: MessageEvent<GeometryWorkerResponse>) => {
      if (event.data.id !== id || settled) return;
      settled = true;
      worker.terminate();
      if (event.data.ok && event.data.type === 'generate-waffle-slices') resolve(event.data.result);
      else if (event.data.ok) reject(new Error('The geometry worker returned the wrong result.'));
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
    type: 'generate-waffle-slices',
    payload: input,
  };
  worker.postMessage(request);

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      rejectTask?.(new DOMException('Waffle generation was cancelled.', 'AbortError'));
    },
  };
}

export function generateFoldTemplateInWorker(
  input: FoldTemplateInput,
): GeometryTask<TemplateGenerationResult> {
  const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
  const id = crypto.randomUUID();
  let settled = false;
  let rejectTask: ((reason?: unknown) => void) | undefined;

  const promise = new Promise<TemplateGenerationResult>((resolve, reject) => {
    rejectTask = reject;
    worker.onmessage = (event: MessageEvent<GeometryWorkerResponse>) => {
      if (event.data.id !== id || settled) return;
      settled = true;
      worker.terminate();
      if (event.data.ok && event.data.type === 'generate-fold-template') resolve(event.data.result);
      else if (event.data.ok) reject(new Error('The geometry worker returned the wrong result.'));
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
    type: 'generate-fold-template',
    payload: input,
  };
  worker.postMessage(request);

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      rejectTask?.(new DOMException('Template generation was cancelled.', 'AbortError'));
    },
  };
}

export function generateMeshUnfoldInWorker(input: MeshUnfoldInput): GeometryTask<MeshUnfoldResult> {
  const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
  const id = crypto.randomUUID();
  let settled = false;
  let rejectTask: ((reason?: unknown) => void) | undefined;

  const promise = new Promise<MeshUnfoldResult>((resolve, reject) => {
    rejectTask = reject;
    worker.onmessage = (event: MessageEvent<GeometryWorkerResponse>) => {
      if (event.data.id !== id || settled) return;
      settled = true;
      worker.terminate();
      if (event.data.ok && event.data.type === 'generate-mesh-unfold') resolve(event.data.result);
      else if (event.data.ok) reject(new Error('The geometry worker returned the wrong result.'));
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
    type: 'generate-mesh-unfold',
    payload: input,
  };
  worker.postMessage(request);

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      rejectTask?.(new DOMException('Mesh unfolding was cancelled.', 'AbortError'));
    },
  };
}

export function generatePanelConstructionInWorker(
  input: PanelConstructionInput,
): GeometryTask<PanelConstructionResult> {
  const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
  const id = crypto.randomUUID();
  let settled = false;
  let rejectTask: ((reason?: unknown) => void) | undefined;

  const promise = new Promise<PanelConstructionResult>((resolve, reject) => {
    rejectTask = reject;
    worker.onmessage = (event: MessageEvent<GeometryWorkerResponse>) => {
      if (event.data.id !== id || settled) return;
      settled = true;
      worker.terminate();
      if (event.data.ok && event.data.type === 'generate-panel-construction')
        resolve(event.data.result);
      else if (event.data.ok) reject(new Error('The geometry worker returned the wrong result.'));
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
    type: 'generate-panel-construction',
    payload: input,
  };
  worker.postMessage(request);

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      rejectTask?.(new DOMException('Panel generation was cancelled.', 'AbortError'));
    },
  };
}
