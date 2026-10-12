import type { Point2D, SerializableTriangleMesh, Vector3Mm } from './geometry';
import type { ValidationIssue } from './validation';

export type EdgeIntent = 'auto' | 'must-cut' | 'must-join';
export interface PapercraftEdgeEdit {
  id: string;
  intent: EdgeIntent;
  tab: { owner: 'face-a' | 'face-b' | 'none'; targetDepthMm: number; shoulderAngleDeg: number };
}
export interface PapercraftIslandEdit {
  id: string;
  rootFaceId: string;
  translationMm: [number, number];
  rotationDeg: number;
  layoutLocked: boolean;
}
export interface PapercraftSettingsV2 {
  algorithmVersion: 'papercraft-v2';
  sourceMeshHash: string;
  faceTarget: number;
  maximumDeviationMm: number;
  mergePlanarFaces: boolean;
  optimizer: 'balanced' | 'few-pieces' | 'compact' | 'preserve-sharp-edges';
  maxCandidates: number;
  tabDefaultDepthMm: number;
  tabShoulderAngleDeg: number;
  edgeEdits: PapercraftEdgeEdit[];
  islandEdits: PapercraftIslandEdit[];
}
export const papercraftDefaults = (sourceMeshHash: string): PapercraftSettingsV2 => ({
  algorithmVersion: 'papercraft-v2',
  sourceMeshHash,
  faceTarget: 200,
  maximumDeviationMm: 0.5,
  mergePlanarFaces: true,
  optimizer: 'balanced',
  maxCandidates: 12,
  tabDefaultDepthMm: 6,
  tabShoulderAngleDeg: 45,
  edgeEdits: [],
  islandEdits: [],
});
export interface PapercraftHalfEdge {
  id: string;
  edgeKey: string;
  faceId: string;
  faceIndex: number;
  startVertex: number;
  endVertex: number;
  nextId: string;
  oppositeId?: string;
  lengthMm: number;
  signedDihedralDeg?: number;
  joinable: boolean;
  softCoplanar: boolean;
}
export interface PapercraftSourceFace {
  id: string;
  index: number;
  vertexIds: [number, number, number];
  normal: Vector3Mm;
  sourceFaceIds: string[];
}
export interface PapercraftPanel {
  id: string;
  faceIds: string[];
  boundaryVertexIds: number[];
  verified: boolean;
}
export interface PreparedPapercraftSource {
  mesh: SerializableTriangleMesh;
  sourceMeshHash: string;
  faces: PapercraftSourceFace[];
  halfEdges: PapercraftHalfEdge[];
  panels: PapercraftPanel[];
  issues: ValidationIssue[];
  metrics: {
    beforeFaceCount: number;
    afterFaceCount: number;
    maximumDeviationMm: number;
    simplified: boolean;
  };
}
export interface PapercraftFlatFace {
  id: string;
  sourceFaceIndex: number;
  vertexIds: [number, number, number];
  points: [Point2D, Point2D, Point2D];
}
export interface PapercraftIsland {
  id: string;
  rootFaceId: string;
  faceIds: string[];
}
export interface PapercraftForest {
  faces: PapercraftFlatFace[];
  hingeKeys: string[];
  islands: PapercraftIsland[];
  issues: ValidationIssue[];
  score: number[];
}
export interface PapercraftKernelInput {
  mesh: SerializableTriangleMesh;
  settings: PapercraftSettingsV2;
  materialThicknessMm: number;
  /** Explicit consent for this computation; source mesh is always retained by the caller. */
  acceptSimplification?: boolean;
}
export interface PapercraftKernelResult extends PapercraftForest {
  algorithmVersion: 'papercraft-v2';
  inputHash: string;
  source: PreparedPapercraftSource;
  searchExhausted: boolean;
}
export interface PapercraftProgress {
  stage: 'prepared' | 'candidates' | 'optimization' | 'tabs' | 'completed';
  done: number;
  total: number;
}
export interface PapercraftRunHooks {
  progress?: (progress: PapercraftProgress) => void;
  cancelled?: () => boolean;
  /** Optional worker deadline. It can stop search, never relax geometry validity. */
  budgetExpired?: () => boolean;
}
