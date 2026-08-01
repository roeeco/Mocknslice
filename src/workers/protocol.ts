import type { StlUnit } from '../domain/model';
import type { NormalizedMeshResult } from '../geometry/mesh/normalizeMesh';
import type {
  StackedSliceInput,
  StackedSliceResult,
  WaffleSliceInput,
  WaffleSliceResult,
} from '../geometry/slicing/types';

export interface NormalizeStlRequest {
  id: string;
  type: 'normalize-stl';
  payload: {
    arrayBuffer: ArrayBuffer;
    assumedUnit: StlUnit;
  };
}

export interface GenerateStackedSlicesRequest {
  id: string;
  type: 'generate-stacked-slices';
  payload: StackedSliceInput;
}

export interface GenerateWaffleSlicesRequest {
  id: string;
  type: 'generate-waffle-slices';
  payload: WaffleSliceInput;
}

export type GeometryWorkerRequest =
  NormalizeStlRequest | GenerateStackedSlicesRequest | GenerateWaffleSlicesRequest;

export type GeometryWorkerResponse =
  | { id: string; type: 'normalize-stl'; ok: true; result: NormalizedMeshResult }
  | { id: string; type: 'generate-stacked-slices'; ok: true; result: StackedSliceResult }
  | { id: string; type: 'generate-waffle-slices'; ok: true; result: WaffleSliceResult }
  | { id: string; type: GeometryWorkerRequest['type']; ok: false; error: string };
