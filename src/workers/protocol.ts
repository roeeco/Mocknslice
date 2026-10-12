import type {
  PapercraftKernelInput,
  PapercraftResult,
  PapercraftProgress,
} from '../domain/papercraft';
import type { StlUnit } from '../domain/model';
import type { NormalizedMeshResult } from '../geometry/mesh/normalizeMesh';
import type { FoldTemplateInput } from '../geometry/folding/generateFoldTemplate';
import type { TemplateGenerationResult } from '../domain/folding';
import type { MeshUnfoldResult } from '../domain/unfolding';
import type { MeshUnfoldInput } from '../geometry/unfolding/generateMeshUnfold';
import type { PanelConstructionResult } from '../domain/panelConstruction';
import type { PanelConstructionInput } from '../geometry/panelConstruction/generatePanelConstruction';
import type {
  StackedSliceInput,
  StackedSliceResult,
  WaffleSliceInput,
  WaffleSliceResult,
} from '../geometry/slicing/types';
import type {
  PreparePanelUnfoldInput,
  PreparePanelUnfoldResult,
} from '../geometry/unfolding/generatePanelUnfold';

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

export interface GenerateFoldTemplateRequest {
  id: string;
  type: 'generate-fold-template';
  payload: FoldTemplateInput;
}

export interface GenerateMeshUnfoldRequest {
  id: string;
  type: 'generate-mesh-unfold';
  payload: MeshUnfoldInput;
}

export interface GeneratePanelConstructionRequest {
  id: string;
  type: 'generate-panel-construction';
  payload: PanelConstructionInput;
}

export interface PreparePanelUnfoldRequest {
  id: string;
  type: 'prepare-panel-unfold';
  payload: PreparePanelUnfoldInput;
}

export interface GeneratePapercraftRequest {
  id: string;
  type: 'generate-papercraft';
  payload: PapercraftKernelInput;
}
export interface PapercraftWorkerProgress {
  id: string;
  type: 'papercraft-progress';
  progress: PapercraftProgress;
}

export type GeometryWorkerRequest =
  | GeneratePapercraftRequest
  | NormalizeStlRequest
  | GenerateStackedSlicesRequest
  | GenerateWaffleSlicesRequest
  | GenerateFoldTemplateRequest
  | GenerateMeshUnfoldRequest
  | PreparePanelUnfoldRequest
  | GeneratePanelConstructionRequest;

export type GeometryWorkerResponse =
  | { id: string; type: 'generate-papercraft'; ok: true; result: PapercraftResult }
  | { id: string; type: 'normalize-stl'; ok: true; result: NormalizedMeshResult }
  | { id: string; type: 'generate-stacked-slices'; ok: true; result: StackedSliceResult }
  | { id: string; type: 'generate-waffle-slices'; ok: true; result: WaffleSliceResult }
  | { id: string; type: 'generate-fold-template'; ok: true; result: TemplateGenerationResult }
  | { id: string; type: 'generate-mesh-unfold'; ok: true; result: MeshUnfoldResult }
  | { id: string; type: 'prepare-panel-unfold'; ok: true; result: PreparePanelUnfoldResult }
  | {
      id: string;
      type: 'generate-panel-construction';
      ok: true;
      result: PanelConstructionResult;
    }
  | { id: string; type: GeometryWorkerRequest['type']; ok: false; error: string };
