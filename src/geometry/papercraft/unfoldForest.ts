import type {
  PapercraftFlatFace,
  PapercraftForest,
  PapercraftHalfEdge,
  PreparedPapercraftSource,
  PapercraftSettingsV2,
} from '../../domain/papercraft';
import { flattenFaces, flatEdge, rigidEdgeMap } from './edgeGeometry';
import { forestComponents, normalizeIslands } from './islands';
import { faceIslandsOverlap, boundsOf } from './intersection';
import { tracePapercraftPerimeter } from './tracePerimeter';
import { papercraftIssue } from './prepareSource';

export function uniqueSourceEdges(source: PreparedPapercraftSource): PapercraftHalfEdge[] {
  const keys = new Set<string>();
  return source.halfEdges
    .filter((e) => {
      if (keys.has(e.edgeKey)) return false;
      keys.add(e.edgeKey);
      return true;
    })
    .sort((a, b) => a.edgeKey.localeCompare(b.edgeKey));
}
export function scoreForest(
  source: PreparedPapercraftSource,
  faces: PapercraftFlatFace[],
  hinges: string[],
): number[] {
  const islands = forestComponents(source, hinges);
  const area = islands.reduce((sum, island) => {
    const b = boundsOf(faces.filter((f) => island.faceIds.includes(f.id)).flatMap((f) => f.points));
    return sum + (b.maxX - b.minX) * (b.maxY - b.minY);
  }, 0);
  return [
    0,
    0,
    islands.length,
    uniqueSourceEdges(source)
      .filter((e) => !hinges.includes(e.edgeKey))
      .reduce((s, e) => s + e.lengthMm, 0),
    area,
    0,
  ];
}
export function tryForestJoin(
  source: PreparedPapercraftSource,
  faces: PapercraftFlatFace[],
  hinges: string[],
  edge: PapercraftHalfEdge,
):
  | { faces: PapercraftFlatFace[]; hinges: string[] }
  | 'cycle'
  | 'collision'
  | 'length'
  | 'perimeter' {
  const opposite = source.halfEdges.find((e) => e.id === edge.oppositeId);
  if (!edge.joinable || !opposite) return 'length';
  const components = forestComponents(source, hinges),
    a = components.find((i) => i.faceIds.includes(edge.faceId))!,
    b = components.find((i) => i.faceIds.includes(opposite.faceId))!;
  if (a.id === b.id) return 'cycle';
  const parent = faces.filter((f) => a.faceIds.includes(f.id)),
    child = faces.filter((f) => b.faceIds.includes(f.id));
  const transform = rigidEdgeMap(
    flatEdge(
      child.find((f) => f.id === opposite.faceId)!,
      opposite,
    ),
    flatEdge(
      parent.find((f) => f.id === edge.faceId)!,
      edge,
    ),
    edge.lengthMm,
  );
  if (!transform) return 'length';
  const moved = child.map((f) => ({
    ...f,
    points: f.points.map(transform) as PapercraftFlatFace['points'],
  }));
  if (faceIslandsOverlap(parent, moved)) return 'collision';
  const joinedHinges = [...hinges, edge.edgeKey].sort();
  if (!tracePapercraftPerimeter(source, [...parent, ...moved], joinedHinges)) return 'perimeter';
  const byId = new Map(moved.map((f) => [f.id, f]));
  return { faces: faces.map((f) => byId.get(f.id) ?? f), hinges: joinedHinges };
}
export function unfoldForest(
  source: PreparedPapercraftSource,
  settings: PapercraftSettingsV2,
  order: readonly PapercraftHalfEdge[],
  forcedOrder?: readonly string[],
  excluded: readonly string[] = [],
  shouldStop?: () => boolean,
): PapercraftForest {
  let faces = flattenFaces(source),
    hinges: string[] = [];
  const issues = [...source.issues],
    edges = uniqueSourceEdges(source),
    byKey = new Map(edges.map((e) => [e.edgeKey, e]));
  const seen = new Set<string>();
  for (const edit of settings.edgeEdits) {
    if (seen.has(edit.id) || !byKey.has(edit.id))
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_UNKNOWN_EDGE',
          [edit.id],
          'Unknown or duplicate source edge edit.',
        ),
      );
    seen.add(edit.id);
  }
  const forced =
    forcedOrder ??
    settings.edgeEdits
      .filter((e) => e.intent === 'must-join')
      .map((e) => e.id)
      .sort();
  // Diagnose topological cycles independently of incidental collision order.
  const parent = new Map(source.faces.map((f) => [f.id, f.id]));
  const find = (id: string): string => (parent.get(id) === id ? id : find(parent.get(id)!));
  for (const key of forced) {
    const edge = byKey.get(key),
      opposite = source.halfEdges.find((e) => e.id === edge?.oppositeId);
    if (!edge || !opposite) continue;
    const a = find(edge.faceId),
      b = find(opposite.faceId);
    if (a === b) {
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_FORCED_JOIN_CYCLE',
          [key, ...forced],
          'Forced joins form a cycle. Split one highlighted edge.',
        ),
      );
      break;
    }
    parent.set(b, a);
  }
  if (!issues.length)
    for (const key of forced) {
      const edge = byKey.get(key);
      if (!edge || !edge.joinable) {
        issues.push(
          papercraftIssue('PAPERCRAFT_JOIN_UNAVAILABLE', [key], 'This edge cannot be joined.'),
        );
        break;
      }
      const joined = tryForestJoin(source, faces, hinges, edge);
      if (typeof joined === 'string') {
        issues.push(
          papercraftIssue(
            `PAPERCRAFT_FORCED_JOIN_${joined.toUpperCase()}`,
            [key],
            'A forced join would create an invalid net. Change the highlighted constraint.',
          ),
        );
        break;
      }
      faces = joined.faces;
      hinges = joined.hinges;
    }
  const cuts = new Set([
    ...settings.edgeEdits.filter((e) => e.intent === 'must-cut').map((e) => e.id),
    ...excluded,
  ]);
  if (!issues.length)
    for (const edge of order) {
      if (shouldStop?.()) break;
      if (cuts.has(edge.edgeKey) || hinges.includes(edge.edgeKey) || !edge.joinable) continue;
      const joined = tryForestJoin(source, faces, hinges, edge);
      if (typeof joined === 'string') continue;
      faces = joined.faces;
      hinges = joined.hinges;
    }
  const islands = forestComponents(source, hinges);
  return {
    faces: normalizeIslands(faces, islands),
    hingeKeys: hinges,
    islands,
    issues,
    score: scoreForest(source, faces, hinges),
  };
}
