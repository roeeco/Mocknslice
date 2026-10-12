import type { SerializableTriangleMesh, Vector3Mm } from '../../domain/geometry';
import type {
  PapercraftEdgeEdit,
  PapercraftIslandEdit,
  PapercraftResult,
  PapercraftSettingsV2,
} from '../../domain/papercraft';
import { hashSerializable } from '../../domain/canonicalHash';
import { papercraftHalfEdges } from './halfEdge';
import { preflightPapercraftSource } from './prepareSource';
import { meshVertex } from '../unfolding/meshAdjacency';
export interface UnresolvedPapercraftEdit {
  id: string;
  kind: 'edge' | 'island';
  reason: string;
  edit: PapercraftEdgeEdit | PapercraftIslandEdit;
}
export interface PapercraftRelinkProposal {
  sourceMeshHash: string;
  edgeEdits: PapercraftEdgeEdit[];
  islandEdits: PapercraftIslandEdit[];
  unresolvedEdits: UnresolvedPapercraftEdit[];
  edgeMatches: { oldId: string; newId: string; confidence: number }[];
  faceMatches: { oldId: string; newId: string }[];
  issues: ReturnType<typeof preflightPapercraftSource>;
}
const distance = (a: Vector3Mm, b: Vector3Mm) => Math.hypot(...a.map((v, i) => v - b[i]!));
const angle = (a: Vector3Mm, b: Vector3Mm) =>
  (Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        a.reduce((sum, v, i) => sum + v * b[i]!, 0),
      ),
    ),
  ) *
    180) /
  Math.PI;
const centre = (points: Vector3Mm[]): Vector3Mm =>
  [0, 1, 2].map(
    (axis) => points.reduce((sum, p) => sum + p[axis]!, 0) / points.length,
  ) as Vector3Mm;
/** Mutual unique nearest matching only; ties and inconsistent adjacent faces are unresolved. */
function mutualMatches<A extends { id: string }, B extends { id: string }>(
  old: A[],
  next: B[],
  cost: (a: A, b: B) => number | undefined,
) {
  const best = <T extends { id: string }>(
    entries: T[],
    score: (value: T) => number | undefined,
  ) => {
    const candidates = entries
      .flatMap((value) => {
        const s = score(value);
        return s === undefined ? [] : [{ value, score: s }];
      })
      .sort((a, b) => a.score - b.score || a.value.id.localeCompare(b.value.id));
    if (
      !candidates.length ||
      (candidates[1] && Math.abs(candidates[0]!.score - candidates[1].score) < 1e-8)
    )
      return;
    return candidates[0];
  };
  const forward = new Map(old.map((a) => [a.id, best(next, (b) => cost(a, b))]));
  const backward = new Map(next.map((b) => [b.id, best(old, (a) => cost(a, b))]));
  return new Map(
    old.flatMap((a) => {
      const candidate = forward.get(a.id);
      return candidate && backward.get(candidate.value.id)?.value.id === a.id
        ? [
            [
              a.id,
              { value: candidate.value, confidence: 1 - Math.min(1, candidate.score) },
            ] as const,
          ]
        : [];
    }),
  );
}
export function relinkOnModelUpdate(
  oldMesh: SerializableTriangleMesh,
  newMesh: SerializableTriangleMesh,
  settings: PapercraftSettingsV2,
  result?: PapercraftResult,
): PapercraftRelinkProposal {
  const hash = hashSerializable(newMesh),
    issues = preflightPapercraftSource(newMesh);
  const proposal: PapercraftRelinkProposal = {
    sourceMeshHash: hash,
    edgeEdits: [],
    islandEdits: [],
    unresolvedEdits: [],
    edgeMatches: [],
    faceMatches: [],
    issues,
  };
  if (hashSerializable(oldMesh) === hash && !issues.length)
    return {
      ...proposal,
      edgeEdits: structuredClone(settings.edgeEdits),
      islandEdits: structuredClone(settings.islandEdits),
      edgeMatches: settings.edgeEdits.map((e) => ({ oldId: e.id, newId: e.id, confidence: 1 })),
      faceMatches: (result?.source.faces ?? []).map((f) => ({ oldId: f.id, newId: f.id })),
    };
  const oldTopology = papercraftHalfEdges(oldMesh),
    newTopology = issues.length ? { faces: [], halfEdges: [] } : papercraftHalfEdges(newMesh);
  const faceCentre = (mesh: SerializableTriangleMesh, face: (typeof oldTopology.faces)[number]) =>
    centre(face.vertexIds.map((id) => meshVertex(mesh, id)));
  const faces = mutualMatches(oldTopology.faces, newTopology.faces, (a, b) => {
    const d = distance(faceCentre(oldMesh, a), faceCentre(newMesh, b)),
      n = angle(a.normal, b.normal);
    return d <= 0.1 && n <= 5 ? Math.max(d / 0.1, n / 5) : undefined;
  });
  proposal.faceMatches = [...faces].map(([oldId, match]) => ({ oldId, newId: match.value.id }));
  const unique = (halfEdges: typeof oldTopology.halfEdges) =>
    halfEdges
      .filter(
        (e) =>
          e.oppositeId &&
          e.faceIndex < halfEdges.find((other) => other.id === e.oppositeId)!.faceIndex,
      )
      .map((e) => ({ ...e, id: e.edgeKey }));
  const oldEdges = unique(oldTopology.halfEdges),
    nextEdges = unique(newTopology.halfEdges);
  const midpoint = (mesh: SerializableTriangleMesh, e: (typeof oldEdges)[number]) =>
    centre([meshVertex(mesh, e.startVertex), meshVertex(mesh, e.endVertex)]);
  const matches = mutualMatches(oldEdges, nextEdges, (a, b) => {
    const d = distance(midpoint(oldMesh, a), midpoint(newMesh, b)),
      l = Math.abs(a.lengthMm - b.lengthMm) / a.lengthMm;
    const partnerA = oldTopology.halfEdges.find((e) => e.id === a.oppositeId)!,
      partnerB = newTopology.halfEdges.find((e) => e.id === b.oppositeId)!;
    const mapped = [faces.get(a.faceId)?.value.id, faces.get(partnerA.faceId)?.value.id];
    if (!mapped.includes(b.faceId) || !mapped.includes(partnerB.faceId)) return;
    return d <= 0.1 && l <= 0.02 ? Math.max(d / 0.1, l / 0.02) : undefined;
  });
  for (const edit of settings.edgeEdits) {
    const match = matches.get(edit.id),
      old = oldEdges.find((e) => e.id === edit.id);
    if (!match || !old) {
      proposal.unresolvedEdits.push({
        id: `edge:${hashSerializable(oldMesh)}:${edit.id}`,
        kind: 'edge',
        reason: 'No unique mutual edge match within 0.1 mm, 2% length and 5° normals.',
        edit: structuredClone(edit),
      });
      continue;
    }
    const swapped = faces.get(old.faceId)?.value.id !== match.value.faceId,
      owner = edit.tab.owner;
    proposal.edgeEdits.push({
      ...structuredClone(edit),
      id: match.value.id,
      tab: {
        ...edit.tab,
        owner: swapped && owner !== 'none' ? (owner === 'face-a' ? 'face-b' : 'face-a') : owner,
      },
    });
    proposal.edgeMatches.push({
      oldId: edit.id,
      newId: match.value.id,
      confidence: match.confidence,
    });
  }
  for (const edit of settings.islandEdits) {
    const island = result?.islands.find((i) => i.id === edit.id),
      sourceFaces = edit.sourceFaceIds ?? island?.faceIds ?? [],
      mapped = sourceFaces.flatMap((id) => (faces.get(id) ? [faces.get(id)!.value.id] : [])),
      mappedRoot = faces.get(edit.rootFaceId)?.value.id;
    if (!sourceFaces.length || mapped.length / sourceFaces.length < 0.7 || !mappedRoot) {
      proposal.unresolvedEdits.push({
        id: `island:${hashSerializable(oldMesh)}:${edit.id}`,
        kind: 'island',
        reason: 'Island has less than 70% confidently relinked faces.',
        edit: structuredClone(edit),
      });
      continue;
    }
    proposal.islandEdits.push({
      ...structuredClone(edit),
      rootFaceId: mappedRoot,
      sourceFaceIds: mapped.sort(),
    });
  }
  return proposal;
}
