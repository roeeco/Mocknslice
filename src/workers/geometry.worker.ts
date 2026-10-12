/// <reference lib="webworker" />

import { normalizeMesh } from '../geometry/mesh/normalizeMesh';
import { parseStl } from '../importers/importSTL';
import { generateStackedSlices } from '../geometry/slicing/generateStackedSlices';
import { generateWaffleSlices } from '../geometry/slicing/generateWaffleSlices';
import { generateRegisteredTemplate } from '../templates/registry';
import { generateMeshUnfold } from '../geometry/unfolding/generateMeshUnfold';
import { generatePanelConstruction } from '../geometry/panelConstruction/generatePanelConstruction';
import { prepareAndGeneratePanelUnfold } from '../geometry/unfolding/generatePanelUnfold';
import type { GeometryWorkerRequest, GeometryWorkerResponse } from './protocol';

const context: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

context.onmessage = (event: MessageEvent<GeometryWorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'normalize-stl') {
      const soup = parseStl(request.payload.arrayBuffer);
      const result = normalizeMesh(soup, { assumedUnit: request.payload.assumedUnit });
      const response: GeometryWorkerResponse = {
        id: request.id,
        type: request.type,
        ok: true,
        result,
      };
      context.postMessage(response);
    } else if (request.type === 'generate-stacked-slices') {
      const result = generateStackedSlices(request.payload);
      const response: GeometryWorkerResponse = {
        id: request.id,
        type: request.type,
        ok: true,
        result,
      };
      context.postMessage(response);
    } else if (request.type === 'generate-waffle-slices') {
      const result = generateWaffleSlices(request.payload);
      const response: GeometryWorkerResponse = {
        id: request.id,
        type: request.type,
        ok: true,
        result,
      };
      context.postMessage(response);
    } else if (request.type === 'generate-fold-template') {
      const result = generateRegisteredTemplate(request.payload);
      const response: GeometryWorkerResponse = {
        id: request.id,
        type: request.type,
        ok: true,
        result,
      };
      context.postMessage(response);
    } else if (request.type === 'generate-mesh-unfold') {
      const result = generateMeshUnfold(request.payload);
      const response: GeometryWorkerResponse = {
        id: request.id,
        type: request.type,
        ok: true,
        result,
      };
      context.postMessage(response);
    } else if (request.type === 'prepare-panel-unfold') {
      const result = prepareAndGeneratePanelUnfold(request.payload);
      const response: GeometryWorkerResponse = {
        id: request.id,
        type: request.type,
        ok: true,
        result,
      };
      context.postMessage(response);
    } else {
      const result = generatePanelConstruction(request.payload);
      const response: GeometryWorkerResponse = {
        id: request.id,
        type: request.type,
        ok: true,
        result,
      };
      context.postMessage(response);
    }
  } catch (error) {
    const response: GeometryWorkerResponse = {
      id: request.id,
      type: request.type,
      ok: false,
      error: error instanceof Error ? error.message : 'STL processing failed.',
    };
    context.postMessage(response);
  }
};
