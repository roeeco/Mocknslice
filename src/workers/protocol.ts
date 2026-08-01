import type { StlUnit } from '../domain/model';
import type { NormalizedMeshResult } from '../geometry/mesh/normalizeMesh';

export interface NormalizeStlRequest {
  id: string;
  type: 'normalize-stl';
  payload: {
    arrayBuffer: ArrayBuffer;
    assumedUnit: StlUnit;
  };
}

export type GeometryWorkerRequest = NormalizeStlRequest;

export type GeometryWorkerResponse =
  { id: string; ok: true; result: NormalizedMeshResult } | { id: string; ok: false; error: string };
