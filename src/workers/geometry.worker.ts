/// <reference lib="webworker" />

import { normalizeMesh } from '../geometry/mesh/normalizeMesh';
import { parseStl } from '../importers/importSTL';
import type { GeometryWorkerRequest, GeometryWorkerResponse } from './protocol';

const context: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

context.onmessage = (event: MessageEvent<GeometryWorkerRequest>) => {
  const request = event.data;
  try {
    const soup = parseStl(request.payload.arrayBuffer);
    const result = normalizeMesh(soup, { assumedUnit: request.payload.assumedUnit });
    const response: GeometryWorkerResponse = { id: request.id, ok: true, result };
    context.postMessage(response);
  } catch (error) {
    const response: GeometryWorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : 'STL processing failed.',
    };
    context.postMessage(response);
  }
};
