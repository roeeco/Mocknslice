import type {
  PapercraftFlatFace,
  PapercraftIsland,
  PreparedPapercraftSource,
} from '../../domain/papercraft';
import { hashSerializable } from '../../domain/canonicalHash';

export function forestComponents(
  source: PreparedPapercraftSource,
  hinges: readonly string[],
): PapercraftIsland[] {
  const parent = new Map(source.faces.map((f) => [f.id, f.id]));
  const find = (id: string): string => {
    const p = parent.get(id)!;
    if (p === id) return p;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const byId = new Map(source.halfEdges.map((e) => [e.id, e]));
  for (const edge of source.halfEdges.filter((e) => hinges.includes(e.edgeKey) && e.oppositeId)) {
    const a = find(edge.faceId),
      b = find(byId.get(edge.oppositeId!)!.faceId);
    if (a !== b) {
      parent.set(b, a < b ? a : b);
      parent.set(a, a < b ? a : b);
    }
  }
  const groups = new Map<string, string[]>();
  for (const face of source.faces) {
    const root = find(face.id);
    groups.set(root, [...(groups.get(root) ?? []), face.id]);
  }
  return [...groups.values()]
    .map((ids) => {
      const faceIds = ids.sort();
      return { id: `island-${hashSerializable(faceIds)}`, rootFaceId: faceIds[0]!, faceIds };
    })
    .sort((a, b) => a.rootFaceId.localeCompare(b.rootFaceId));
}
export function normalizeIslands(
  faces: readonly PapercraftFlatFace[],
  islands: readonly PapercraftIsland[],
): PapercraftFlatFace[] {
  const output = new Map(faces.map((f) => [f.id, f]));
  for (const island of islands) {
    const members = faces.filter((f) => island.faceIds.includes(f.id)),
      points = members.flatMap((f) => f.points),
      x = Math.min(...points.map((p) => p.x)),
      y = Math.min(...points.map((p) => p.y));
    for (const face of members)
      output.set(face.id, {
        ...face,
        points: face.points.map((p) => ({
          x: p.x - x,
          y: p.y - y,
        })) as PapercraftFlatFace['points'],
      });
  }
  return faces.map((f) => output.get(f.id)!);
}
