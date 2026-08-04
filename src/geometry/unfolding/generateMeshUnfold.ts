import type { FabricationLabel, FabricationPart, FabricationPath } from '../../domain/fabrication';
import type { FoldConnection, FoldTab } from '../../domain/folding';
import type { Point2D, SerializableTriangleMesh, Vector3Mm } from '../../domain/geometry';
import type {
  MeshUnfoldEdge,
  MeshUnfoldFace,
  MeshUnfoldHinge,
  MeshUnfoldIsland,
  MeshUnfoldOverlap,
  MeshUnfoldResult,
  MeshUnfoldSettings,
} from '../../domain/unfolding';
import type { ValidationIssue } from '../../domain/validation';
import {
  buildMeshTopology,
  meshEdgeKey,
  meshVertex,
  type MeshTopology,
  type TopologyEdge,
} from './meshAdjacency';

export const MESH_UNFOLD_ALGORITHM_VERSION = 'triangle-tree-v1';

export interface MeshUnfoldInput {
  mesh: SerializableTriangleMesh;
  modelId: string;
  materialThicknessMm: number;
  settings: MeshUnfoldSettings;
}

interface TreeRelation {
  parentFaceIndex: number;
  childFaceIndex: number;
  edge: TopologyEdge;
}

interface UnfoldCandidate {
  relations: TreeRelation[];
  roots: number[];
  facePoints: Map<number, Map<number, Point2D>>;
  islandByFace: Map<number, number>;
  overlaps: MeshUnfoldOverlap[];
  score: number;
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundedPoint(point: Point2D): Point2D {
  return { x: rounded(point.x), y: rounded(point.y) };
}

function distance3(a: Vector3Mm, b: Vector3Mm): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function triangleAtRoot(mesh: SerializableTriangleMesh, vertices: [number, number, number]) {
  const a = meshVertex(mesh, vertices[0]);
  const b = meshVertex(mesh, vertices[1]);
  const c = meshVertex(mesh, vertices[2]);
  const ab = distance3(a, b);
  const ac = distance3(a, c);
  const bc = distance3(b, c);
  const x = ab > 1e-9 ? (ac * ac + ab * ab - bc * bc) / (2 * ab) : 0;
  const y = Math.sqrt(Math.max(0, ac * ac - x * x));
  return new Map<number, Point2D>([
    [vertices[0], { x: 0, y: 0 }],
    [vertices[1], { x: ab, y: 0 }],
    [vertices[2], { x, y }],
  ]);
}

function sideOfLine(start: Point2D, end: Point2D, point: Point2D): number {
  return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
}

function thirdPoint(
  start: Point2D,
  end: Point2D,
  distanceFromStart: number,
  distanceFromEnd: number,
): [Point2D, Point2D] | undefined {
  const edgeLength = Math.hypot(end.x - start.x, end.y - start.y);
  if (edgeLength <= 1e-9) return undefined;
  const along =
    (distanceFromStart * distanceFromStart +
      edgeLength * edgeLength -
      distanceFromEnd * distanceFromEnd) /
    (2 * edgeLength);
  const heightSquared = distanceFromStart * distanceFromStart - along * along;
  if (heightSquared < -1e-5) return undefined;
  const height = Math.sqrt(Math.max(0, heightSquared));
  const unit = { x: (end.x - start.x) / edgeLength, y: (end.y - start.y) / edgeLength };
  const perpendicular = { x: -unit.y, y: unit.x };
  const base = { x: start.x + unit.x * along, y: start.y + unit.y * along };
  return [
    { x: base.x + perpendicular.x * height, y: base.y + perpendicular.y * height },
    { x: base.x - perpendicular.x * height, y: base.y - perpendicular.y * height },
  ];
}

function edgesByFace(topology: MeshTopology): Map<number, TopologyEdge[]> {
  const result = new Map<number, TopologyEdge[]>();
  for (const edge of topology.edges.filter((candidate) => candidate.uses.length === 2)) {
    for (const use of edge.uses) {
      const list = result.get(use.faceIndex) ?? [];
      list.push(edge);
      result.set(use.faceIndex, list);
    }
  }
  return result;
}

function buildForest(
  topology: MeshTopology,
  rootFaceIndex: number,
  forbiddenEdges: ReadonlySet<string>,
  orderMode: number,
  reverse: boolean,
): { relations: TreeRelation[]; roots: number[] } {
  const byFace = edgesByFace(topology);
  const visited = new Set<number>();
  const relations: TreeRelation[] = [];
  const roots: number[] = [];
  const startOrder = [
    Math.max(0, Math.min(topology.faces.length - 1, rootFaceIndex)),
    ...topology.faces.map((face) => face.index),
  ];
  for (const root of startOrder) {
    if (visited.has(root)) continue;
    roots.push(root);
    visited.add(root);
    const queue = [root];
    while (queue.length > 0) {
      const parent = queue.shift()!;
      const candidates = (byFace.get(parent) ?? [])
        .filter((edge) => !forbiddenEdges.has(edge.key))
        .map((edge) => ({
          edge,
          child:
            edge.uses[0]!.faceIndex === parent ? edge.uses[1]!.faceIndex : edge.uses[0]!.faceIndex,
        }))
        .sort((a, b) => {
          const angleOrder = (a.edge.dihedralDeg ?? 0) - (b.edge.dihedralDeg ?? 0);
          const comparison =
            orderMode === 0 ? a.child - b.child : orderMode === 1 ? angleOrder : -angleOrder;
          return comparison === 0 ? a.child - b.child : comparison;
        });
      if (reverse) candidates.reverse();
      for (const candidate of candidates) {
        if (visited.has(candidate.child)) continue;
        visited.add(candidate.child);
        relations.push({
          parentFaceIndex: parent,
          childFaceIndex: candidate.child,
          edge: candidate.edge,
        });
        queue.push(candidate.child);
      }
    }
  }
  return { relations, roots };
}

function flattenForest(
  mesh: SerializableTriangleMesh,
  topology: MeshTopology,
  forest: { relations: TreeRelation[]; roots: number[] },
):
  { facePoints: Map<number, Map<number, Point2D>>; islandByFace: Map<number, number> } | undefined {
  const facePoints = new Map<number, Map<number, Point2D>>();
  const islandByFace = new Map<number, number>();
  const children = new Map<number, TreeRelation[]>();
  for (const relation of forest.relations) {
    const list = children.get(relation.parentFaceIndex) ?? [];
    list.push(relation);
    children.set(relation.parentFaceIndex, list);
  }
  let flattenFailed = false;
  for (const [islandIndex, root] of forest.roots.entries()) {
    facePoints.set(root, triangleAtRoot(mesh, topology.faces[root]!.vertices));
    islandByFace.set(root, islandIndex);
    const queue = [root];
    while (queue.length > 0) {
      const parentIndex = queue.shift()!;
      const parentFace = topology.faces[parentIndex]!;
      const parentPoints = facePoints.get(parentIndex)!;
      for (const relation of children.get(parentIndex) ?? []) {
        const childFace = topology.faces[relation.childFaceIndex]!;
        const vertexA = relation.edge.vertexA;
        const vertexB = relation.edge.vertexB;
        const start = parentPoints.get(vertexA);
        const end = parentPoints.get(vertexB);
        if (!start || !end) {
          flattenFailed = true;
          break;
        }
        const parentThird = parentFace.vertices.find(
          (vertex) => vertex !== vertexA && vertex !== vertexB,
        );
        const childThird = childFace.vertices.find(
          (vertex) => vertex !== vertexA && vertex !== vertexB,
        );
        if (parentThird === undefined || childThird === undefined) {
          flattenFailed = true;
          break;
        }
        const candidates = thirdPoint(
          start,
          end,
          distance3(meshVertex(mesh, vertexA), meshVertex(mesh, childThird)),
          distance3(meshVertex(mesh, vertexB), meshVertex(mesh, childThird)),
        );
        if (!candidates) {
          flattenFailed = true;
          break;
        }
        const parentPoint = parentPoints.get(parentThird)!;
        const parentSide = sideOfLine(start, end, parentPoint);
        const chosen =
          candidates.find((candidate) => sideOfLine(start, end, candidate) * parentSide < 0) ??
          candidates[0];
        facePoints.set(
          relation.childFaceIndex,
          new Map<number, Point2D>([
            [vertexA, { ...start }],
            [vertexB, { ...end }],
            [childThird, chosen],
          ]),
        );
        islandByFace.set(relation.childFaceIndex, islandByFace.get(parentIndex)!);
        queue.push(relation.childFaceIndex);
      }
      if (flattenFailed) break;
    }
    if (flattenFailed) break;
  }
  if (flattenFailed || facePoints.size !== topology.faces.length) return undefined;

  let cursorX = 0;
  for (let island = 0; island < forest.roots.length; island += 1) {
    const entries = [...facePoints.entries()].filter(
      ([faceIndex]) => islandByFace.get(faceIndex) === island,
    );
    const all = entries.flatMap(([, points]) => [...points.values()]);
    const minX = Math.min(...all.map((point) => point.x));
    const minY = Math.min(...all.map((point) => point.y));
    const maxX = Math.max(...all.map((point) => point.x));
    for (const [, points] of entries) {
      for (const [vertex, point] of points) {
        points.set(vertex, roundedPoint({ x: point.x - minX + cursorX, y: point.y - minY }));
      }
    }
    cursorX += maxX - minX + 10;
  }
  return { facePoints, islandByFace };
}

function triangleOverlap(first: readonly Point2D[], second: readonly Point2D[]): boolean {
  const axes = [...first, ...second].map((point, index) => {
    const source = index < first.length ? first : second;
    const local = index < first.length ? index : index - first.length;
    const next = source[(local + 1) % source.length]!;
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: -dy / length, y: dx / length };
  });
  return axes.every((axis) => {
    const a = first.map((point) => point.x * axis.x + point.y * axis.y);
    const b = second.map((point) => point.x * axis.x + point.y * axis.y);
    return (
      Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b)) > 1e-5
    );
  });
}

function overlapsFor(
  topology: MeshTopology,
  facePoints: Map<number, Map<number, Point2D>>,
  islandByFace: Map<number, number>,
): MeshUnfoldOverlap[] {
  const overlaps: MeshUnfoldOverlap[] = [];
  for (let first = 0; first < topology.faces.length; first += 1) {
    for (let second = first + 1; second < topology.faces.length; second += 1) {
      const island = islandByFace.get(first)!;
      if (island !== islandByFace.get(second)) continue;
      const a = topology.faces[first]!.vertices.map((vertex) =>
        facePoints.get(first)!.get(vertex)!,
      ) as [Point2D, Point2D, Point2D];
      const b = topology.faces[second]!.vertices.map((vertex) =>
        facePoints.get(second)!.get(vertex)!,
      ) as [Point2D, Point2D, Point2D];
      if (triangleOverlap(a, b)) {
        overlaps.push({
          faceAId: `unfold-face-${first + 1}`,
          faceBId: `unfold-face-${second + 1}`,
          islandIndex: island,
        });
      }
    }
  }
  return overlaps;
}

function candidateScore(
  facePoints: Map<number, Map<number, Point2D>>,
  islandByFace: Map<number, number>,
  overlaps: readonly MeshUnfoldOverlap[],
): number {
  let area = 0;
  const islands = new Set(islandByFace.values());
  for (const island of islands) {
    const points = [...facePoints.entries()]
      .filter(([face]) => islandByFace.get(face) === island)
      .flatMap(([, mapping]) => [...mapping.values()]);
    area +=
      (Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))) *
      (Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y)));
  }
  return overlaps.length * 1_000_000_000 + islands.size * 1_000_000 + area;
}

function makeCandidate(
  mesh: SerializableTriangleMesh,
  topology: MeshTopology,
  forest: { relations: TreeRelation[]; roots: number[] },
): UnfoldCandidate | undefined {
  const flattened = flattenForest(mesh, topology, forest);
  if (!flattened) return undefined;
  const overlaps = overlapsFor(topology, flattened.facePoints, flattened.islandByFace);
  return {
    ...forest,
    ...flattened,
    overlaps,
    score: candidateScore(flattened.facePoints, flattened.islandByFace, overlaps),
  };
}

function vectorSubtract(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vectorCross(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function vectorDot(a: Vector3Mm, b: Vector3Mm): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function foldAngleDeg(
  mesh: SerializableTriangleMesh,
  topology: MeshTopology,
  relation: TreeRelation,
): number {
  const axisRaw = vectorSubtract(
    meshVertex(mesh, relation.edge.vertexB),
    meshVertex(mesh, relation.edge.vertexA),
  );
  const axisLength = Math.hypot(...axisRaw) || 1;
  const axis: Vector3Mm = [
    axisRaw[0] / axisLength,
    axisRaw[1] / axisLength,
    axisRaw[2] / axisLength,
  ];
  const parentNormal = topology.faces[relation.parentFaceIndex]!.normal;
  const childNormal = topology.faces[relation.childFaceIndex]!.normal;
  return rounded(
    (Math.atan2(
      vectorDot(axis, vectorCross(parentNormal, childNormal)),
      vectorDot(parentNormal, childNormal),
    ) *
      180) /
      Math.PI,
  );
}

function centroid(points: readonly Point2D[]): Point2D {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function tabOutline(
  start: Point2D,
  end: Point2D,
  ownerPoints: readonly Point2D[],
  depthMm: number,
): Point2D[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const unit = { x: dx / length, y: dy / length };
  const centre = centroid(ownerPoints);
  const candidate = { x: unit.y, y: -unit.x };
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const towardCentre = { x: centre.x - midpoint.x, y: centre.y - midpoint.y };
  const pointsInward = candidate.x * towardCentre.x + candidate.y * towardCentre.y > 0;
  const outward = pointsInward ? { x: -candidate.x, y: -candidate.y } : candidate;
  const inset = Math.min(depthMm * 0.35, length * 0.2);
  return [
    start,
    {
      x: start.x + unit.x * inset + outward.x * depthMm,
      y: start.y + unit.y * inset + outward.y * depthMm,
    },
    {
      x: end.x - unit.x * inset + outward.x * depthMm,
      y: end.y - unit.y * inset + outward.y * depthMm,
    },
    end,
  ].map(roundedPoint);
}

function fnv1a(values: readonly (string | number)[]): string {
  let hash = 0x811c9dc5;
  const text = values.join('|');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `sf8-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function deterministicUnfoldHash(input: MeshUnfoldInput): string {
  return fnv1a([
    ...input.mesh.positionsMm,
    ...input.mesh.indices,
    input.modelId,
    input.materialThicknessMm,
    input.settings.strategy,
    input.settings.rootFaceIndex,
    [...input.settings.manualSeamKeys].sort().join(','),
    input.settings.tabDepthMm,
    input.settings.maximumFaceCount,
    input.settings.searchAttempts,
  ]);
}

function emptyResult(input: MeshUnfoldInput, issues: ValidationIssue[]): MeshUnfoldResult {
  return {
    settings: input.settings,
    faces: [],
    edges: [],
    connections: [],
    tabs: [],
    hinges: [],
    islands: [],
    overlapPairs: [],
    parts: [],
    issues,
    algorithmVersion: MESH_UNFOLD_ALGORITHM_VERSION,
    inputHash: deterministicUnfoldHash(input),
  };
}

export function generateMeshUnfold(input: MeshUnfoldInput): MeshUnfoldResult {
  const topology = buildMeshTopology(input.mesh);
  const issues: ValidationIssue[] = [];
  if (
    !Number.isFinite(input.settings.tabDepthMm) ||
    input.settings.tabDepthMm <= 0 ||
    !Number.isInteger(input.settings.maximumFaceCount) ||
    input.settings.maximumFaceCount < 1 ||
    !Number.isInteger(input.settings.searchAttempts) ||
    input.settings.searchAttempts < 1
  ) {
    return emptyResult(input, [
      {
        id: `unfold-settings-invalid-${input.modelId}`,
        severity: 'error',
        code: 'UNFOLD_SETTINGS_INVALID',
        message: 'Tab depth, face limit, and search attempts must be positive values.',
        affectedEntityIds: [input.modelId],
        suggestedAction: 'Correct the unfolding settings and generate the net again.',
      },
    ]);
  }
  if (topology.faces.length === 0 || topology.faces.length > input.settings.maximumFaceCount) {
    return emptyResult(input, [
      {
        id: `unfold-face-limit-${input.modelId}`,
        severity: 'error',
        code: 'UNFOLD_FACE_LIMIT',
        message: `This release supports 1–${input.settings.maximumFaceCount} triangular faces; the model has ${topology.faces.length}.`,
        affectedEntityIds: [input.modelId],
        suggestedAction:
          'Use a lower-poly closed model or increase the explicit face limit cautiously.',
      },
    ]);
  }
  if (
    topology.boundaryEdgeCount > 0 ||
    topology.nonManifoldEdgeCount > 0 ||
    topology.orientationIssueCount > 0
  ) {
    return emptyResult(input, [
      {
        id: `unfold-topology-invalid-${input.modelId}`,
        severity: 'error',
        code: 'UNFOLD_REQUIRES_CLOSED_MANIFOLD',
        message:
          'Mesh unfolding requires a closed, manifold, consistently oriented triangular mesh.',
        affectedEntityIds: [input.modelId],
        suggestedAction: 'Repair the mesh or use a shape-aware folding template.',
      },
    ]);
  }
  const sharedKeys = new Set(
    topology.edges.filter((edge) => edge.uses.length === 2).map((edge) => edge.key),
  );
  const manualSeams = new Set(input.settings.manualSeamKeys.filter((key) => sharedKeys.has(key)));
  const ignoredSeams = input.settings.manualSeamKeys.filter((key) => !sharedKeys.has(key));
  if (ignoredSeams.length > 0) {
    issues.push({
      id: `unfold-ignored-seams-${input.modelId}`,
      severity: 'info',
      code: 'UNFOLD_UNKNOWN_SEAMS_IGNORED',
      message: `${ignoredSeams.length} seam reference${ignoredSeams.length === 1 ? ' was' : 's were'} not present in this mesh and was ignored.`,
      affectedEntityIds: [input.modelId],
      suggestedAction: 'Review seams after changing or reimporting the source mesh.',
    });
  }
  let best: UnfoldCandidate | undefined;
  if (input.settings.strategy === 'manual') {
    const forest = buildForest(topology, input.settings.rootFaceIndex, manualSeams, 0, false);
    best = makeCandidate(input.mesh, topology, forest);
    const hingeKeys = new Set(forest.relations.map((relation) => relation.edge.key));
    const automaticallyAdded = topology.edges.filter(
      (edge) => edge.uses.length === 2 && !manualSeams.has(edge.key) && !hingeKeys.has(edge.key),
    );
    if (automaticallyAdded.length > 0) {
      issues.push({
        id: `unfold-cycle-seams-${input.modelId}`,
        severity: 'info',
        code: 'UNFOLD_CYCLE_SEAMS_ADDED',
        message: `${automaticallyAdded.length} additional seam${automaticallyAdded.length === 1 ? ' was' : 's were'} required to create an acyclic fold graph.`,
        affectedEntityIds: automaticallyAdded.map((edge) => `unfold-edge-${edge.key}`),
        suggestedAction: 'Review the automatically added seams before fabrication.',
      });
    }
  } else {
    const attempts = Math.max(
      1,
      Math.min(input.settings.searchAttempts, topology.faces.length * 6),
    );
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const requestedRoot = Number.isFinite(input.settings.rootFaceIndex)
        ? Math.trunc(input.settings.rootFaceIndex)
        : 0;
      const root =
        (((requestedRoot + attempt) % topology.faces.length) + topology.faces.length) %
        topology.faces.length;
      const candidate = makeCandidate(
        input.mesh,
        topology,
        buildForest(topology, root, new Set(), attempt % 3, Math.floor(attempt / 3) % 2 === 1),
      );
      if (candidate && (!best || candidate.score < best.score)) best = candidate;
      if (best?.overlaps.length === 0 && attempt >= Math.min(5, attempts - 1)) break;
    }
  }
  if (!best) {
    return emptyResult(input, [
      {
        id: `unfold-flatten-failed-${input.modelId}`,
        severity: 'error',
        code: 'UNFOLD_FLATTEN_FAILED',
        message: 'The triangle tree could not be flattened reliably.',
        affectedEntityIds: [input.modelId],
        suggestedAction: 'Inspect the mesh for degenerate or inconsistent triangles.',
      },
    ]);
  }

  const relationByKey = new Map(best.relations.map((relation) => [relation.edge.key, relation]));
  const faces: MeshUnfoldFace[] = topology.faces.map((face) => {
    const islandIndex = best.islandByFace.get(face.index)!;
    const partId = `unfold-island-${islandIndex + 1}`;
    const points = face.vertices.map((vertex) => best.facePoints.get(face.index)!.get(vertex)!) as [
      Point2D,
      Point2D,
      Point2D,
    ];
    return {
      id: `unfold-face-${face.index + 1}`,
      partId,
      islandIndex,
      faceIndex: face.index,
      sourceVertexIndices: face.vertices,
      points2D: points.map(roundedPoint) as [Point2D, Point2D, Point2D],
      flatVerticesMm: points.map((point) => [point.x, point.y, 0] as Vector3Mm) as [
        Vector3Mm,
        Vector3Mm,
        Vector3Mm,
      ],
      sourceVerticesMm: face.vertices.map((vertex) => meshVertex(input.mesh, vertex)) as [
        Vector3Mm,
        Vector3Mm,
        Vector3Mm,
      ],
    };
  });
  const facesByIndex = new Map(faces.map((face) => [face.faceIndex, face]));
  let foldLabel = 0;
  let seamLabel = 0;
  const edges: MeshUnfoldEdge[] = topology.edges.map((edge) => {
    const relation = relationByKey.get(edge.key);
    if (relation) {
      foldLabel += 1;
      const angle = foldAngleDeg(input.mesh, topology, relation);
      return {
        id: `unfold-edge-${edge.key}`,
        key: edge.key,
        vertexA: edge.vertexA,
        vertexB: edge.vertexB,
        faceAIndex: edge.uses[0]!.faceIndex,
        faceBIndex: edge.uses[1]!.faceIndex,
        disposition: 'hinge',
        foldDirection: angle >= 0 ? 'valley' : 'mountain',
        dihedralDeg: rounded(Math.abs(angle)),
        pairLabel: `F${foldLabel}`,
      };
    }
    if (edge.uses.length === 1) {
      return {
        id: `unfold-edge-${edge.key}`,
        key: edge.key,
        vertexA: edge.vertexA,
        vertexB: edge.vertexB,
        faceAIndex: edge.uses[0]!.faceIndex,
        disposition: 'boundary',
      };
    }
    seamLabel += 1;
    return {
      id: `unfold-edge-${edge.key}`,
      key: edge.key,
      vertexA: edge.vertexA,
      vertexB: edge.vertexB,
      faceAIndex: edge.uses[0]!.faceIndex,
      faceBIndex: edge.uses[1]!.faceIndex,
      disposition:
        input.settings.strategy === 'manual' && !manualSeams.has(edge.key) ? 'auto-seam' : 'seam',
      dihedralDeg: rounded(edge.dihedralDeg ?? 0),
      pairLabel: `S${seamLabel}`,
    };
  });
  const hinges: MeshUnfoldHinge[] = best.relations.map((relation) => ({
    id: `unfold-hinge-${relation.edge.key}`,
    parentFaceId: facesByIndex.get(relation.parentFaceIndex)!.id,
    childFaceId: facesByIndex.get(relation.childFaceIndex)!.id,
    vertexA: relation.edge.vertexA,
    vertexB: relation.edge.vertexB,
    foldAngleDeg: foldAngleDeg(input.mesh, topology, relation),
  }));

  const tabs: FoldTab[] = [];
  const parts: FabricationPart[] = [];
  const islandCount = Math.max(...best.islandByFace.values()) + 1;
  const islands: MeshUnfoldIsland[] = [];
  for (let islandIndex = 0; islandIndex < islandCount; islandIndex += 1) {
    const islandFaces = faces.filter((face) => face.islandIndex === islandIndex);
    const partId = `unfold-island-${islandIndex + 1}`;
    const paths: FabricationPath[] = [];
    const labels: FabricationLabel[] = islandFaces.map((face) => ({
      id: `${face.id}-label`,
      text: `T${face.faceIndex + 1}`,
      position: roundedPoint(centroid(face.points2D)),
      operation: 'engrave',
      entityId: face.id,
    }));
    for (const face of islandFaces) {
      for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
        const startVertex = face.sourceVertexIndices[edgeIndex]!;
        const endVertex = face.sourceVertexIndices[(edgeIndex + 1) % 3]!;
        const key = meshEdgeKey(startVertex, endVertex);
        const edge = edges.find((candidate) => candidate.key === key)!;
        const relation = relationByKey.get(key);
        const start = face.points2D[edgeIndex]!;
        const end = face.points2D[(edgeIndex + 1) % 3]!;
        if (edge.disposition === 'hinge') {
          if (relation?.parentFaceIndex !== face.faceIndex) continue;
          paths.push({
            id: `${edge.id}-fold`,
            operation: edge.foldDirection === 'mountain' ? 'mountain-fold' : 'valley-fold',
            closed: false,
            points: [start, end],
            panelId: face.id,
            edgeId: edge.id,
          });
          continue;
        }
        const owner = edge.faceAIndex === face.faceIndex;
        if (owner && edge.disposition !== 'boundary' && edge.faceBIndex !== undefined) {
          const outline = tabOutline(start, end, face.points2D, input.settings.tabDepthMm);
          const tabId = `unfold-tab-${key}`;
          tabs.push({
            id: tabId,
            partId,
            edgeId: edge.id,
            ownerPanelId: face.id,
            style: 'glue',
            depthMm: rounded(input.settings.tabDepthMm),
            shoulderAngleDeg: 20,
            enabled: true,
            baseStart: start,
            baseEnd: end,
            outline,
            ...(faces.find((candidate) => candidate.faceIndex === edge.faceBIndex)?.id
              ? {
                  receiverPanelId: faces.find(
                    (candidate) => candidate.faceIndex === edge.faceBIndex,
                  )!.id,
                }
              : {}),
          });
          paths.push(
            {
              id: `${tabId}-cut`,
              operation: 'cut',
              closed: false,
              points: outline,
              panelId: face.id,
              edgeId: edge.id,
              tabId,
            },
            {
              id: `${tabId}-score`,
              operation: 'score',
              closed: false,
              points: [start, end],
              panelId: face.id,
              edgeId: edge.id,
              tabId,
            },
          );
        } else {
          paths.push({
            id: `${edge.id}-${face.id}-cut`,
            operation: 'cut',
            closed: false,
            points: [start, end],
            panelId: face.id,
            edgeId: edge.id,
          });
        }
        if (edge.pairLabel) {
          const faceCentre = centroid(face.points2D);
          const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
          const vector = { x: faceCentre.x - midpoint.x, y: faceCentre.y - midpoint.y };
          const length = Math.hypot(vector.x, vector.y) || 1;
          labels.push({
            id: `${edge.id}-${face.id}-label`,
            text: edge.pairLabel,
            position: roundedPoint({
              x: midpoint.x + (vector.x / length) * 2,
              y: midpoint.y + (vector.y / length) * 2,
            }),
            operation: 'engrave',
            entityId: edge.id,
          });
        }
      }
    }
    const faceIds = islandFaces.map((face) => face.id);
    islands.push({
      id: `unfold-island-definition-${islandIndex + 1}`,
      index: islandIndex,
      partId,
      faceIds,
    });
    parts.push({
      id: partId,
      name: `Unfolded net ${islandIndex + 1}`,
      label: `Net ${islandIndex + 1}`,
      paths,
      labels,
      thicknessMm: input.materialThicknessMm,
      sourceReference: input.modelId,
      unfolding: { islandIndex, faceIds },
    });
  }

  if (best.overlaps.length > 0) {
    issues.push({
      id: `unfold-overlap-${input.modelId}`,
      severity: 'warning',
      code: 'UNFOLD_OVERLAP_REMAINS',
      message: `${best.overlaps.length} overlapping face pair${best.overlaps.length === 1 ? ' remains' : 's remain'} in the selected net.`,
      affectedEntityIds: best.overlaps.flatMap((overlap) => [overlap.faceAId, overlap.faceBId]),
      suggestedAction: 'Try other seams or increase automatic search attempts.',
    });
  }
  const tabCollisionIds = new Set<string>();
  for (const tab of tabs) {
    const ownerFace = faces.find((face) => face.id === tab.ownerPanelId);
    if (!ownerFace) continue;
    for (const face of faces.filter(
      (candidate) => candidate.partId === tab.partId && candidate.id !== tab.ownerPanelId,
    )) {
      if (triangleOverlap(tab.outline, face.points2D)) {
        tabCollisionIds.add(tab.id);
        tabCollisionIds.add(face.id);
      }
    }
    for (const other of tabs) {
      if (other.id <= tab.id || other.partId !== tab.partId) continue;
      if (triangleOverlap(tab.outline, other.outline)) {
        tabCollisionIds.add(tab.id);
        tabCollisionIds.add(other.id);
      }
    }
  }
  if (tabCollisionIds.size > 0) {
    issues.push({
      id: `unfold-tab-overlap-${input.modelId}`,
      severity: 'warning',
      code: 'UNFOLD_TAB_OVERLAP',
      message: 'One or more glue tabs overlap another face or tab in the flat net.',
      affectedEntityIds: [...tabCollisionIds].sort(),
      suggestedAction: 'Reduce tab depth or choose different manual seams before fabrication.',
    });
  }
  if (islands.length > 1) {
    issues.push({
      id: `unfold-multiple-islands-${input.modelId}`,
      severity: 'info',
      code: 'UNFOLD_MULTIPLE_ISLANDS',
      message: `The selected seams produce ${islands.length} separate net islands.`,
      affectedEntityIds: islands.map((island) => island.partId),
      suggestedAction: 'Use paired seam labels to assemble the islands.',
    });
  }
  const faceByIndex = new Map(faces.map((face) => [face.faceIndex, face]));
  const connections: FoldConnection[] = edges.flatMap((edge) => {
    if (edge.faceBIndex === undefined) return [];
    const a = faceByIndex.get(edge.faceAIndex);
    const b = faceByIndex.get(edge.faceBIndex);
    if (!a || !b) return [];
    const segmentFor = (face: MeshUnfoldFace) => {
      const startIndex = face.sourceVertexIndices.indexOf(edge.vertexA);
      const endIndex = face.sourceVertexIndices.indexOf(edge.vertexB);
      return { start: face.points2D[startIndex]!, end: face.points2D[endIndex]! };
    };
    const tab = tabs.find((candidate) => candidate.edgeId === edge.id && candidate.enabled);
    return [
      {
        id: `${edge.id}-connection`,
        panelAId: a.id,
        panelBId: b.id,
        edgeA: segmentFor(a),
        edgeB: segmentFor(b),
        disposition: edge.disposition === 'hinge' ? 'hinge' : 'seam',
        closure:
          edge.disposition === 'hinge'
            ? 'none'
            : tab?.style === 'press-fit'
              ? 'press-fit'
              : tab
                ? 'glue-tab'
                : 'none',
        required: edge.disposition !== 'hinge',
        tabIds: tab ? [tab.id] : [],
      },
    ];
  });
  return {
    settings: input.settings,
    faces,
    edges,
    connections,
    tabs,
    hinges,
    islands,
    overlapPairs: best.overlaps,
    parts,
    issues,
    algorithmVersion: MESH_UNFOLD_ALGORITHM_VERSION,
    inputHash: deterministicUnfoldHash(input),
  };
}
