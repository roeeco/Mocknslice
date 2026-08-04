import type { PreparedMesh, PreparedPanel } from '../../domain/preparedMesh';
import type { Point2D, Vector3Mm } from '../../domain/geometry';
import type { SerializableTriangleMesh } from '../../domain/geometry';
import { mergePlanarRegions } from '../mesh/mergePlanarRegions';

export interface PanelUnfoldSettings {
  mustCutConnectionIds?: string[];
  mustFoldConnectionIds?: string[];
  preferCutConnectionIds?: string[];
  maximumCandidates?: number;
}

export interface PanelUnfoldConnection {
  id: string;
  panelAId: string;
  panelBId: string;
  vertexA: number;
  vertexB: number;
}

export interface PanelUnfoldPlacement {
  panelId: string;
  points2D: Point2D[];
}

export interface PanelUnfoldScore {
  invalidConnectionCount: number;
  faceOverlapArea: number;
  tabOverlapArea: number;
  flippedPolygonCount: number;
  islandCount: number;
  sheetOverflow: number;
  totalSeamLength: number;
  boundingArea: number;
  aspectRatio: number;
  symmetryPenalty: number;
  assemblyAccessPenalty: number;
}

export interface PanelUnfoldCandidate {
  id: string;
  hingeConnectionIds: string[];
  seamConnectionIds: string[];
  placements: PanelUnfoldPlacement[];
  score: PanelUnfoldScore;
}

export interface PanelUnfoldResult {
  candidates: PanelUnfoldCandidate[];
  connections: PanelUnfoldConnection[];
  issues: { code: string; message: string }[];
  algorithmVersion: string;
}

export interface PreparePanelUnfoldInput {
  mesh: SerializableTriangleMesh;
  maximumPlanarityErrorMm: number;
  sharpAngleDeg: number;
  settings?: PanelUnfoldSettings;
}

export interface PreparePanelUnfoldResult {
  preparedMesh: PreparedMesh;
  unfolding: PanelUnfoldResult;
}

export function prepareAndGeneratePanelUnfold(
  input: PreparePanelUnfoldInput,
): PreparePanelUnfoldResult {
  const preparedMesh = mergePlanarRegions(
    input.mesh,
    input.maximumPlanarityErrorMm,
    input.sharpAngleDeg,
  );
  return {
    preparedMesh,
    unfolding: generatePanelUnfold(preparedMesh, input.settings),
  };
}

function vertex(mesh: PreparedMesh['sourceMesh'], index: number): Vector3Mm {
  return [
    mesh.positionsMm[index * 3]!,
    mesh.positionsMm[index * 3 + 1]!,
    mesh.positionsMm[index * 3 + 2]!,
  ];
}
function dot(a: Vector3Mm, b: Vector3Mm): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function subtract(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function unit(a: Vector3Mm): Vector3Mm {
  const n = Math.hypot(...a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
}
function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function connections(prepared: PreparedMesh): PanelUnfoldConnection[] {
  const byEdge = new Map<string, PreparedPanel[]>();
  for (const panel of prepared.panels)
    for (const loop of panel.boundaryLoops)
      for (let index = 0; index < loop.length; index += 1) {
        const key = edgeKey(loop[index]!, loop[(index + 1) % loop.length]!);
        byEdge.set(key, [...(byEdge.get(key) ?? []), panel]);
      }
  return [...byEdge]
    .flatMap(([key, panels]) =>
      panels.length === 2
        ? [
            {
              id: `panel-edge-${key}`,
              panelAId: panels[0]!.id,
              panelBId: panels[1]!.id,
              vertexA: Number(key.split(':')[0]),
              vertexB: Number(key.split(':')[1]),
            },
          ]
        : [],
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

function projectPanel(prepared: PreparedMesh, panel: PreparedPanel): Point2D[] {
  const loop = panel.boundaryLoops[0] ?? [];
  const origin = vertex(prepared.sourceMesh, loop[0] ?? 0);
  const normal = panel.plane.normal;
  const first = unit(subtract(vertex(prepared.sourceMesh, loop[1] ?? loop[0] ?? 0), origin));
  const second = unit(cross(normal, first));
  return loop.map((index) => {
    const delta = subtract(vertex(prepared.sourceMesh, index), origin);
    return { x: dot(delta, first), y: dot(delta, second) };
  });
}

function signedSide(start: Point2D, end: Point2D, point: Point2D): number {
  return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
}

function transformToEdge(
  points: readonly Point2D[],
  childStart: Point2D,
  childEnd: Point2D,
  parentStart: Point2D,
  parentEnd: Point2D,
): Point2D[] {
  const source = { x: childEnd.x - childStart.x, y: childEnd.y - childStart.y };
  const target = { x: parentEnd.x - parentStart.x, y: parentEnd.y - parentStart.y };
  const length = Math.hypot(source.x, source.y) || 1;
  const cosine = (source.x * target.x + source.y * target.y) / (length * length);
  const sine = (source.x * target.y - source.y * target.x) / (length * length);
  return points.map((point) => {
    const x = point.x - childStart.x;
    const y = point.y - childStart.y;
    return { x: parentStart.x + x * cosine - y * sine, y: parentStart.y + x * sine + y * cosine };
  });
}

function reflectAcrossEdge(points: readonly Point2D[], start: Point2D, end: Point2D): Point2D[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  return points.map((point) => {
    const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    const onLine = { x: start.x + projection * dx, y: start.y + projection * dy };
    return { x: 2 * onLine.x - point.x, y: 2 * onLine.y - point.y };
  });
}

function polygonArea(points: readonly Point2D[]): number {
  return (
    Math.abs(
      points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length]!;
        return sum + point.x * next.y - point.y * next.x;
      }, 0),
    ) / 2
  );
}

function bounds(points: readonly Point2D[]) {
  return points.reduce(
    (result, point) => ({
      minX: Math.min(result.minX, point.x),
      minY: Math.min(result.minY, point.y),
      maxX: Math.max(result.maxX, point.x),
      maxY: Math.max(result.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function overlapArea(first: readonly Point2D[], second: readonly Point2D[]): number {
  // Convex clipping is exact for the prepared planar panels currently admitted by v2.
  let output = [...first];
  const orientation = signedSide(second[0]!, second[1]!, second[2]!) >= 0 ? 1 : -1;
  for (let index = 0; index < second.length && output.length; index += 1) {
    const start = second[index]!;
    const end = second[(index + 1) % second.length]!;
    const input = output;
    output = [];
    for (let pointIndex = 0; pointIndex < input.length; pointIndex += 1) {
      const a = input[pointIndex]!;
      const b = input[(pointIndex + 1) % input.length]!;
      const insideA = orientation * signedSide(start, end, a) >= -1e-7;
      const insideB = orientation * signedSide(start, end, b) >= -1e-7;
      if (insideA) output.push(a);
      if (insideA !== insideB) {
        const ab = { x: b.x - a.x, y: b.y - a.y };
        const cd = { x: end.x - start.x, y: end.y - start.y };
        const denominator = ab.x * cd.y - ab.y * cd.x;
        if (Math.abs(denominator) > 1e-9) {
          const t = ((start.x - a.x) * cd.y - (start.y - a.y) * cd.x) / denominator;
          output.push({ x: a.x + t * ab.x, y: a.y + t * ab.y });
        }
      }
    }
  }
  return output.length >= 3 ? polygonArea(output) : 0;
}

function candidate(
  prepared: PreparedMesh,
  all: PanelUnfoldConnection[],
  hinges: PanelUnfoldConnection[],
  id: string,
): PanelUnfoldCandidate {
  const local = new Map(prepared.panels.map((panel) => [panel.id, projectPanel(prepared, panel)]));
  const byId = new Map(prepared.panels.map((panel) => [panel.id, panel]));
  const adjacency = new Map<string, PanelUnfoldConnection[]>();
  for (const hinge of hinges)
    for (const id of [hinge.panelAId, hinge.panelBId])
      adjacency.set(id, [...(adjacency.get(id) ?? []), hinge]);
  const placed = new Map<string, Point2D[]>();
  const root = prepared.panels[0];
  if (root) placed.set(root.id, local.get(root.id)!);
  const queue = root ? [root.id] : [];
  while (queue.length) {
    const parentId = queue.shift()!;
    for (const hinge of adjacency.get(parentId) ?? []) {
      const childId = hinge.panelAId === parentId ? hinge.panelBId : hinge.panelAId;
      if (placed.has(childId)) continue;
      const parentPanel = byId.get(parentId)!;
      const childPanel = byId.get(childId)!;
      const parentLocal = parentPanel.sourceVertexIndices.indexOf(hinge.vertexA);
      const parentEndLocal = parentPanel.sourceVertexIndices.indexOf(hinge.vertexB);
      const childStartLocal = childPanel.sourceVertexIndices.indexOf(hinge.vertexA);
      const childEndLocal = childPanel.sourceVertexIndices.indexOf(hinge.vertexB);
      const parentPoints = placed.get(parentId)!;
      const childPoints = local.get(childId)!;
      let next = transformToEdge(
        childPoints,
        childPoints[childStartLocal]!,
        childPoints[childEndLocal]!,
        parentPoints[parentLocal]!,
        parentPoints[parentEndLocal]!,
      );
      const parentOther = parentPoints.find(
        (_, index) => index !== parentLocal && index !== parentEndLocal,
      );
      const childOther = next.find(
        (_, index) => index !== childStartLocal && index !== childEndLocal,
      );
      if (
        parentOther &&
        childOther &&
        signedSide(parentPoints[parentLocal]!, parentPoints[parentEndLocal]!, parentOther) *
          signedSide(parentPoints[parentLocal]!, parentPoints[parentEndLocal]!, childOther) >
          0
      )
        next = reflectAcrossEdge(next, parentPoints[parentLocal]!, parentPoints[parentEndLocal]!);
      placed.set(childId, next);
      queue.push(childId);
    }
  }
  const placements = prepared.panels.map((panel) => ({
    panelId: panel.id,
    points2D: placed.get(panel.id) ?? local.get(panel.id)!,
  }));
  const seam = all.filter((connection) => !hinges.some((hinge) => hinge.id === connection.id));
  return {
    id,
    hingeConnectionIds: hinges.map((connection) => connection.id),
    seamConnectionIds: seam.map((connection) => connection.id),
    placements,
    score: {
      invalidConnectionCount: 0,
      faceOverlapArea: placements.reduce(
        (sum, placement, index) =>
          sum +
          placements
            .slice(index + 1)
            .reduce((inner, other) => inner + overlapArea(placement.points2D, other.points2D), 0),
        0,
      ),
      tabOverlapArea: 0,
      flippedPolygonCount: 0,
      islandCount: 1,
      sheetOverflow: 0,
      totalSeamLength: seam.reduce((sum, connection) => {
        const a = vertex(prepared.sourceMesh, connection.vertexA);
        const b = vertex(prepared.sourceMesh, connection.vertexB);
        return sum + Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      }, 0),
      boundingArea: (() => {
        const box = bounds(placements.flatMap((placement) => placement.points2D));
        return (box.maxX - box.minX) * (box.maxY - box.minY);
      })(),
      aspectRatio: (() => {
        const box = bounds(placements.flatMap((placement) => placement.points2D));
        const width = box.maxX - box.minX;
        const height = box.maxY - box.minY;
        return Math.max(width, height) / Math.max(1e-9, Math.min(width, height));
      })(),
      symmetryPenalty: 0,
      assemblyAccessPenalty: 0,
    },
  };
}

/** Deterministic panel-dual spanning-tree candidates. Placement is intentionally kept pure for worker execution. */
export function generatePanelUnfold(
  prepared: PreparedMesh,
  settings: PanelUnfoldSettings = {},
): PanelUnfoldResult {
  const all = connections(prepared);
  const forcedCut = new Set(settings.mustCutConnectionIds ?? []);
  const forcedFold = new Set(settings.mustFoldConnectionIds ?? []);
  const issues: { code: string; message: string }[] = [];
  if ([...forcedFold].some((id) => forcedCut.has(id)))
    issues.push({
      code: 'PANEL_UNFOLD_CONSTRAINT_CONFLICT',
      message: 'A connection cannot be both must-cut and must-fold.',
    });
  const usable = all.filter((connection) => !forcedCut.has(connection.id));
  const variants = [
    usable,
    [...usable].reverse(),
    [...usable].sort(
      (a, b) =>
        Number(forcedFold.has(b.id)) - Number(forcedFold.has(a.id)) || a.id.localeCompare(b.id),
    ),
  ];
  const candidates = variants.slice(0, settings.maximumCandidates ?? 3).map((ordered, index) => {
    const hinges: PanelUnfoldConnection[] = [];
    const parent = new Map(prepared.panels.map((panel) => [panel.id, panel.id]));
    const root = (id: string): string => {
      const next = parent.get(id)!;
      if (next === id) return id;
      const resolved = root(next);
      parent.set(id, resolved);
      return resolved;
    };
    for (const connection of ordered) {
      const a = root(connection.panelAId);
      const b = root(connection.panelBId);
      if (a !== b) {
        parent.set(a, b);
        hinges.push(connection);
      }
    }
    return candidate(prepared, all, hinges, `panel-unfold-${index + 1}`);
  });
  return { candidates, connections: all, issues, algorithmVersion: 'panel-unfold-v2-draft' };
}
