import type { SerializableTriangleMesh } from '../../domain/geometry';
import { buildMeshTopology } from '../unfolding/meshAdjacency';
import { measureMeshDeviation, type MeshDeviationMetrics } from './measureMeshDeviation';
import { meshVertex } from '../unfolding/meshAdjacency';

export interface SimplifyMeshQemSettings {
  targetFaceCount: number;
  maximumDeviationMm: number;
  sharpEdgeAngleDeg: number;
}

export interface SimplifyMeshQemHooks {
  acceptTrial?: (trial: SerializableTriangleMesh) => boolean;
  retainLockedCoordinates?: boolean;
  shouldStop?: () => boolean;
}
export interface SimplifyMeshQemResult extends MeshDeviationMetrics {
  mesh: SerializableTriangleMesh;
  beforeFaceCount: number;
  afterFaceCount: number;
  preservedSharpFeatureCount: number;
  rejectedCollapseCount: number;
  algorithmVersion: string;
}

function compact(positions: number[], indices: number[]): SerializableTriangleMesh {
  const used = [...new Set(indices)].sort((a, b) => a - b);
  const remap = new Map(used.map((index, next) => [index, next]));
  return {
    positionsMm: used.flatMap((index) => positions.slice(index * 3, index * 3 + 3)),
    indices: indices.map((index) => remap.get(index)!),
  };
}

type Quadric = number[];

function quadrics(mesh: SerializableTriangleMesh): Map<number, Quadric> {
  const topology = buildMeshTopology(mesh);
  const result = new Map<number, Quadric>();
  for (const face of topology.faces) {
    const point = meshVertex(mesh, face.vertices[0]);
    const plane = [
      ...face.normal,
      -(face.normal[0] * point[0] + face.normal[1] * point[1] + face.normal[2] * point[2]),
    ];
    const matrix = Array.from(
      { length: 16 },
      (_, index) => plane[Math.floor(index / 4)]! * plane[index % 4]!,
    );
    for (const vertex of face.vertices) {
      const existing: Quadric = result.get(vertex) ?? Array<number>(16).fill(0);
      result.set(
        vertex,
        existing.map((value, index) => value + matrix[index]!),
      );
    }
  }
  return result;
}

function quadricCost(quadric: Quadric, point: readonly number[]): number {
  const homogeneous = [point[0]!, point[1]!, point[2]!, 1];
  let cost = 0;
  for (let row = 0; row < 4; row += 1)
    for (let column = 0; column < 4; column += 1)
      cost += homogeneous[row]! * quadric[row * 4 + column]! * homogeneous[column]!;
  return Math.max(0, cost);
}

/** Deterministic conservative edge-collapse stage using plane-distance error as the QEM cost. */
export function simplifyMeshQem(
  source: SerializableTriangleMesh,
  settings: SimplifyMeshQemSettings,
  hooks: SimplifyMeshQemHooks = {},
): SimplifyMeshQemResult {
  let mesh = structuredClone(source);
  let rejectedCollapseCount = 0;
  const rejectedEdges = new Set<string>();
  const initialTopology = buildMeshTopology(source);
  const locked = new Set(
    initialTopology.edges
      .filter(
        (edge) => edge.uses.length !== 2 || (edge.dihedralDeg ?? 180) >= settings.sharpEdgeAngleDeg,
      )
      .flatMap((edge) => [edge.vertexA, edge.vertexB]),
  );
  const lockedCoordinates = new Set(
    [...locked].map((index) => meshVertex(source, index).join(':')),
  );
  const isLocked = (index: number) =>
    hooks.retainLockedCoordinates
      ? lockedCoordinates.has(meshVertex(mesh, index).join(':'))
      : locked.has(index);
  while (mesh.indices.length / 3 > settings.targetFaceCount) {
    if (hooks.shouldStop?.()) break;
    const topology = buildMeshTopology(mesh);
    const vertexQuadrics = quadrics(mesh);
    const cost = (first: number, second: number): number => {
      const base: Quadric = vertexQuadrics.get(first) ?? Array<number>(16).fill(0);
      const combined: Quadric = base.map(
        (value, index) => value + (vertexQuadrics.get(second)?.[index] ?? 0),
      );
      return quadricCost(combined, meshVertex(mesh, first));
    };
    const candidate = topology.edges
      .filter(
        (edge) =>
          edge.uses.length === 2 &&
          !isLocked(edge.vertexA) &&
          !isLocked(edge.vertexB) &&
          !rejectedEdges.has(edge.key),
      )
      .sort(
        (a, b) =>
          cost(a.vertexA, a.vertexB) - cost(b.vertexA, b.vertexB) ||
          a.lengthMm - b.lengthMm ||
          a.key.localeCompare(b.key),
      )[0];
    if (!candidate) break;
    const nextIndices = mesh.indices.map((index) =>
      index === candidate.vertexB ? candidate.vertexA : index,
    );
    const triangles = Array.from({ length: nextIndices.length / 3 }, (_, face) =>
      nextIndices.slice(face * 3, face * 3 + 3),
    );
    const valid = triangles.filter((triangle) => new Set(triangle).size === 3);
    const unique = new Set(valid.map((triangle) => [...triangle].sort((a, b) => a - b).join(':')));
    if (unique.size !== valid.length) {
      rejectedEdges.add(candidate.key);
      rejectedCollapseCount += 1;
      continue;
    }
    const trial = compact(mesh.positionsMm, valid.flat());
    const topologyAfter = buildMeshTopology(trial);
    const deviation = measureMeshDeviation(source, trial);
    if (
      topologyAfter.nonManifoldEdgeCount > topology.nonManifoldEdgeCount ||
      topologyAfter.orientationIssueCount > topology.orientationIssueCount ||
      deviation.maximumDeviationMm > settings.maximumDeviationMm ||
      (hooks.acceptTrial && !hooks.acceptTrial(trial))
    ) {
      rejectedEdges.add(candidate.key);
      rejectedCollapseCount += 1;
      continue;
    }
    mesh = trial;
    rejectedEdges.clear();
  }
  const deviation = measureMeshDeviation(source, mesh);
  return {
    mesh,
    beforeFaceCount: source.indices.length / 3,
    afterFaceCount: mesh.indices.length / 3,
    ...deviation,
    preservedSharpFeatureCount: initialTopology.edges.filter(
      (edge) => (edge.dihedralDeg ?? 0) >= settings.sharpEdgeAngleDeg,
    ).length,
    rejectedCollapseCount,
    algorithmVersion: 'qem-edge-collapse-v1',
  };
}
