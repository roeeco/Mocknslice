import type { PapercraftKernelInput, PreparedPapercraftSource } from '../../domain/papercraft';
import type { SerializableTriangleMesh } from '../../domain/geometry';
import type { ValidationIssue } from '../../domain/validation';
import { hashSerializable } from '../../domain/canonicalHash';
import { buildMeshTopology, meshVertex } from '../unfolding/meshAdjacency';
import { EPS_AREA_MM2 } from '../designGraph/tolerances';
import { simplifyMeshQem } from '../mesh/simplifyMeshQem';
import { papercraftHalfEdges } from './halfEdge';
import { panelizePapercraft } from './panelize';

export const papercraftIssue = (
  code: string,
  ids: string[],
  message: string,
  severity: ValidationIssue['severity'] = 'error',
): ValidationIssue => ({
  id: `${code}:${ids.join(',')}`,
  code,
  severity,
  message,
  affectedEntityIds: ids,
  suggestedAction: 'Review the highlighted source geometry or edit before recalculating.',
});
export function preflightPapercraftSource(mesh: SerializableTriangleMesh): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const count = mesh.positionsMm.length / 3;
  if (
    !Number.isInteger(count) ||
    !mesh.positionsMm.every(Number.isFinite) ||
    !mesh.indices.length ||
    mesh.indices.length % 3 ||
    mesh.indices.some((i) => !Number.isInteger(i) || i < 0 || i >= count)
  )
    return [
      papercraftIssue(
        'PAPERCRAFT_SOURCE_INVALID',
        [],
        'Source needs finite vertices and indexed triangles.',
      ),
    ];
  const topology = buildMeshTopology(mesh);
  const seen = new Set<string>();
  for (const face of topology.faces) {
    const [a, b, c] = face.vertices.map((i) => meshVertex(mesh, i));
    const u = b!.map((v, i) => v - a![i]!),
      v = c!.map((x, i) => x - a![i]!);
    const area =
      Math.hypot(
        u[1]! * v[2]! - u[2]! * v[1]!,
        u[2]! * v[0]! - u[0]! * v[2]!,
        u[0]! * v[1]! - u[1]! * v[0]!,
      ) / 2;
    const key = [...face.vertices].sort((a, b) => a - b).join(':');
    if (area <= EPS_AREA_MM2 || seen.has(key))
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_DEGENERATE_FACE',
          [`face-${face.index}`],
          'Degenerate or duplicate source triangle.',
        ),
      );
    seen.add(key);
  }
  for (const edge of topology.edges) {
    if (edge.uses.length !== 2)
      issues.push(
        papercraftIssue(
          edge.uses.length === 1 ? 'PAPERCRAFT_OPEN_EDGE' : 'PAPERCRAFT_NON_MANIFOLD_EDGE',
          [edge.key, ...edge.uses.map((u) => `face-${u.faceIndex}`)],
          'A closed manifold requires exactly two faces per edge.',
        ),
      );
    else if (edge.uses[0]!.startVertex === edge.uses[1]!.startVertex)
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_WINDING',
          [edge.key, ...edge.uses.map((u) => `face-${u.faceIndex}`)],
          'Adjacent source faces have inconsistent winding.',
        ),
      );
  }
  // Edge manifoldness alone misses pinched vertices: each vertex link must be one cycle.
  const incidentByVertex = new Map<number, number[]>(),
    linkByVertex = new Map<number, Map<number, number[]>>();
  for (const face of topology.faces)
    for (const vertex of face.vertices)
      incidentByVertex.set(vertex, [...(incidentByVertex.get(vertex) ?? []), face.index]);
  for (const edge of topology.edges)
    for (const vertex of [edge.vertexA, edge.vertexB]) {
      const links = linkByVertex.get(vertex) ?? new Map<number, number[]>();
      const [a, b] = edge.uses.map((use) => use.faceIndex);
      if (a !== undefined && b !== undefined) {
        links.set(a, [...(links.get(a) ?? []), b]);
        links.set(b, [...(links.get(b) ?? []), a]);
      }
      linkByVertex.set(vertex, links);
    }
  if (!issues.length)
    for (const [vertex, incident] of incidentByVertex) {
      const neighbours = linkByVertex.get(vertex)!;
      const visited = new Set<number>(),
        queue = [incident[0]!];
      while (queue.length) {
        const f = queue.pop()!;
        if (visited.has(f)) continue;
        visited.add(f);
        queue.push(...(neighbours.get(f) ?? []));
      }
      if (visited.size !== incident.length || incident.some((f) => neighbours.get(f)?.length !== 2))
        issues.push(
          papercraftIssue(
            'PAPERCRAFT_PINCHED_VERTEX',
            [`vertex-${vertex}`, ...incident.map((i) => `face-${i}`)],
            'Source vertex link is not a single manifold cycle.',
          ),
        );
    }
  return issues;
}
function bodyTopology(mesh: SerializableTriangleMesh): string[] {
  const topology = buildMeshTopology(mesh),
    visited = new Set<number>(),
    bodies: string[] = [];
  const neighbours = new Map<number, number[]>();
  for (const edge of topology.edges)
    for (const use of edge.uses)
      neighbours.set(use.faceIndex, [
        ...(neighbours.get(use.faceIndex) ?? []),
        ...edge.uses
          .filter((other) => other.faceIndex !== use.faceIndex)
          .map((other) => other.faceIndex),
      ]);
  for (const seed of topology.faces) {
    if (visited.has(seed.index)) continue;
    const faces = new Set<number>(),
      queue = [seed.index];
    while (queue.length) {
      const i = queue.pop()!;
      if (faces.has(i)) continue;
      faces.add(i);
      visited.add(i);
      queue.push(...(neighbours.get(i) ?? []));
    }
    const edges = topology.edges.filter((e) => e.uses.some((u) => faces.has(u.faceIndex))),
      vertices = new Set(edges.flatMap((e) => [e.vertexA, e.vertexB]));
    let volume = 0;
    for (const i of faces) {
      const [a, b, c] = topology.faces[i]!.vertices.map((v) => meshVertex(mesh, v));
      volume +=
        a![0] * (b![1] * c![2] - b![2] * c![1]) +
        a![1] * (b![2] * c![0] - b![0] * c![2]) +
        a![2] * (b![0] * c![1] - b![1] * c![0]);
    }
    bodies.push(`${vertices.size - edges.length + faces.size}:${Math.sign(volume)}`);
  }
  return bodies.sort();
}
export function preparePapercraftSource(input: PapercraftKernelInput): PreparedPapercraftSource {
  let mesh = structuredClone(input.mesh);
  const issues = preflightPapercraftSource(mesh);
  const beforeFaceCount = mesh.indices.length / 3;
  let maximumDeviationMm = 0,
    simplified = false;
  let sourceMeshHash = 'invalid';
  try {
    sourceMeshHash = hashSerializable(input.mesh);
  } catch {
    /* Preflight reports the malformed source. */
  }
  const settings = input.settings;
  if (settings.sourceMeshHash !== sourceMeshHash)
    issues.push(
      papercraftIssue(
        'PAPERCRAFT_SOURCE_HASH',
        [],
        'Edits refer to a different source mesh; relink and confirm before calculation.',
      ),
    );
  if (
    !Number.isInteger(settings.faceTarget) ||
    settings.faceTarget < 4 ||
    settings.faceTarget > 200 ||
    !Number.isInteger(settings.maxCandidates) ||
    settings.maxCandidates < 1 ||
    settings.maxCandidates > 32 ||
    !Number.isFinite(settings.maximumDeviationMm) ||
    settings.maximumDeviationMm < 0 ||
    !Number.isFinite(input.materialThicknessMm) ||
    input.materialThicknessMm <= 0
  )
    issues.push(
      papercraftIssue(
        'PAPERCRAFT_SETTINGS_INVALID',
        [],
        'Face target, candidate budget, deviation and stock thickness are outside supported bounds.',
      ),
    );
  if (!issues.length && beforeFaceCount > settings.faceTarget && input.acceptSimplification) {
    const result = simplifyMeshQem(mesh, {
      targetFaceCount: settings.faceTarget,
      maximumDeviationMm: settings.maximumDeviationMm,
      sharpEdgeAngleDeg: 30,
    });
    const nextIssues = preflightPapercraftSource(result.mesh);
    const sharpEdges = buildMeshTopology(mesh).edges.filter((e) => (e.dihedralDeg ?? 0) >= 30);
    const nextEdges = buildMeshTopology(result.mesh).edges;
    const near = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]!)) <= 1e-6;
    const sharpPreserved = sharpEdges.every((edge) => {
      const a = meshVertex(mesh, edge.vertexA),
        b = meshVertex(mesh, edge.vertexB);
      return nextEdges.some((next) => {
        const c = meshVertex(result.mesh, next.vertexA),
          d = meshVertex(result.mesh, next.vertexB);
        return (near(a, c) && near(b, d)) || (near(a, d) && near(b, c));
      });
    });
    if (
      nextIssues.length ||
      !sharpPreserved ||
      JSON.stringify(bodyTopology(mesh)) !== JSON.stringify(bodyTopology(result.mesh)) ||
      result.maximumDeviationMm > settings.maximumDeviationMm
    )
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_SIMPLIFICATION_REJECTED',
          [],
          'Simplification changed manifold topology, winding or exceeded the deviation bound.',
        ),
      );
    else {
      mesh = result.mesh;
      maximumDeviationMm = result.maximumDeviationMm;
      simplified = true;
    }
  }
  for (const edit of settings.edgeEdits) {
    if (
      !['auto', 'must-cut', 'must-join'].includes(edit.intent) ||
      !['face-a', 'face-b', 'none'].includes(edit.tab.owner) ||
      !Number.isFinite(edit.tab.targetDepthMm) ||
      edit.tab.targetDepthMm <= 0 ||
      !Number.isFinite(edit.tab.shoulderAngleDeg) ||
      edit.tab.shoulderAngleDeg <= 0 ||
      edit.tab.shoulderAngleDeg >= 90
    )
      issues.push(
        papercraftIssue(
          'PAPERCRAFT_EDGE_EDIT_INVALID',
          [edit.id],
          'Edge intent or tab preference is outside supported bounds.',
        ),
      );
  }
  if (simplified && settings.edgeEdits.length)
    issues.push(
      papercraftIssue(
        'PAPERCRAFT_SIMPLIFIED_EDITS_UNRESOLVED',
        settings.edgeEdits.map((e) => e.id),
        'Simplification changed edge identity. Relink and confirm edits against the accepted mesh.',
      ),
    );
  if (
    !Number.isFinite(settings.tabDefaultDepthMm) ||
    settings.tabDefaultDepthMm <= 0 ||
    !Number.isFinite(settings.tabShoulderAngleDeg) ||
    settings.tabShoulderAngleDeg <= 0 ||
    settings.tabShoulderAngleDeg >= 90
  )
    issues.push(
      papercraftIssue(
        'PAPERCRAFT_TAB_SETTINGS_INVALID',
        [],
        'Tab depth must be positive and shoulder angle between 0 and 90 degrees.',
      ),
    );
  if (!issues.length && mesh.indices.length / 3 > settings.faceTarget)
    issues.push(
      papercraftIssue(
        'PAPERCRAFT_FACE_LIMIT',
        [],
        'Source exceeds the chosen target. Explicitly accept bounded simplification or import a lower-poly source.',
      ),
    );
  const topology = issues.length ? { faces: [], halfEdges: [] } : papercraftHalfEdges(mesh);
  const panels = issues.length ? [] : panelizePapercraft(mesh, settings.mergePlanarFaces);
  const panelOf = new Map(panels.flatMap((p) => p.faceIds.map((id) => [id, p.id] as const)));
  const byId = new Map(topology.halfEdges.map((e) => [e.id, e]));
  for (const edge of topology.halfEdges)
    edge.softCoplanar =
      !!edge.oppositeId &&
      panelOf.get(edge.faceId) === panelOf.get(byId.get(edge.oppositeId)!.faceId);
  return {
    mesh,
    sourceMeshHash,
    ...topology,
    panels,
    issues,
    metrics: {
      beforeFaceCount,
      afterFaceCount: mesh.indices.length / 3,
      maximumDeviationMm,
      simplified,
    },
  };
}
