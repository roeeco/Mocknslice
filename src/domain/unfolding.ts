import type { FabricationPart } from './fabrication';
import type { FoldConnection, FoldTab } from './folding';
import type { Point2D, Vector3Mm } from './geometry';
import type { ValidationIssue } from './validation';

export type MeshUnfoldStrategy = 'automatic' | 'manual';
export type UnfoldEdgeDisposition = 'boundary' | 'hinge' | 'seam' | 'auto-seam';

export interface MeshUnfoldSettings {
  strategy: MeshUnfoldStrategy;
  rootFaceIndex: number;
  manualSeamKeys: string[];
  tabDepthMm: number;
  maximumFaceCount: number;
  searchAttempts: number;
}

export interface MeshUnfoldEdge {
  id: string;
  key: string;
  vertexA: number;
  vertexB: number;
  faceAIndex: number;
  faceBIndex?: number;
  disposition: UnfoldEdgeDisposition;
  foldDirection?: 'mountain' | 'valley';
  dihedralDeg?: number;
  pairLabel?: string;
}

export interface MeshUnfoldFace {
  id: string;
  partId: string;
  islandIndex: number;
  faceIndex: number;
  sourceVertexIndices: [number, number, number];
  points2D: [Point2D, Point2D, Point2D];
  flatVerticesMm: [Vector3Mm, Vector3Mm, Vector3Mm];
  sourceVerticesMm: [Vector3Mm, Vector3Mm, Vector3Mm];
}

export interface MeshUnfoldHinge {
  id: string;
  parentFaceId: string;
  childFaceId: string;
  vertexA: number;
  vertexB: number;
  foldAngleDeg: number;
}

export interface MeshUnfoldIsland {
  id: string;
  index: number;
  partId: string;
  faceIds: string[];
}

export interface MeshUnfoldOverlap {
  faceAId: string;
  faceBId: string;
  islandIndex: number;
}

export interface MeshUnfoldResult {
  settings: MeshUnfoldSettings;
  faces: MeshUnfoldFace[];
  edges: MeshUnfoldEdge[];
  connections: FoldConnection[];
  tabs: FoldTab[];
  hinges: MeshUnfoldHinge[];
  islands: MeshUnfoldIsland[];
  overlapPairs: MeshUnfoldOverlap[];
  parts: FabricationPart[];
  issues: ValidationIssue[];
  algorithmVersion: string;
  inputHash: string;
}
