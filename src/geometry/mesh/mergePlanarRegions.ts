import type { PreparedMesh, PreparedPanel } from '../../domain/preparedMesh';
import type { SerializableTriangleMesh, Vector3Mm } from '../../domain/geometry';
import { buildHalfEdgeTopology } from './halfEdgeTopology';
import { traceRegionBoundary } from './traceRegionBoundary';

export const PREPARED_MESH_ALGORITHM_VERSION = 'panelization-v1';

function vertex(mesh: SerializableTriangleMesh, index: number): Vector3Mm {
  return [
    mesh.positionsMm[index * 3]!,
    mesh.positionsMm[index * 3 + 1]!,
    mesh.positionsMm[index * 3 + 2]!,
  ];
}

function dot(a: Vector3Mm, b: Vector3Mm): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function mergePlanarRegions(
  mesh: SerializableTriangleMesh,
  maximumPlanarityErrorMm = 0.01,
  sharpAngleDeg = 2,
): PreparedMesh {
  const topology = buildHalfEdgeTopology(mesh);
  const neighbours = new Map<number, number[]>();
  for (const edge of topology.edges) {
    if (edge.uses.length !== 2 || (edge.dihedralDeg ?? 180) > sharpAngleDeg) continue;
    const [a, b] = edge.uses;
    neighbours.set(a!.faceIndex, [...(neighbours.get(a!.faceIndex) ?? []), b!.faceIndex]);
    neighbours.set(b!.faceIndex, [...(neighbours.get(b!.faceIndex) ?? []), a!.faceIndex]);
  }
  const assigned = new Set<number>();
  const regions: number[][] = [];
  for (const face of topology.faces) {
    if (assigned.has(face.index)) continue;
    const region = [face.index];
    assigned.add(face.index);
    const queue = [face.index];
    while (queue.length) {
      const current = queue.shift()!;
      for (const candidate of neighbours.get(current) ?? []) {
        if (assigned.has(candidate)) continue;
        const normal = face.normal;
        const constant = dot(normal, vertex(mesh, face.vertices[0]));
        const candidateVertices = topology.faces[candidate]!.vertices;
        if (
          candidateVertices.some(
            (index) =>
              Math.abs(dot(normal, vertex(mesh, index)) - constant) > maximumPlanarityErrorMm,
          )
        )
          continue;
        assigned.add(candidate);
        region.push(candidate);
        queue.push(candidate);
      }
    }
    regions.push(region.sort((a, b) => a - b));
  }
  const regionByFace = new Map<number, number>();
  regions.forEach((region, index) => region.forEach((face) => regionByFace.set(face, index)));
  const panels: PreparedPanel[] = regions.map((faces, index) => {
    const first = topology.faces[faces[0]!]!;
    const normal = first.normal;
    const constantMm = dot(normal, vertex(mesh, first.vertices[0]));
    const vertices = [...new Set(faces.flatMap((face) => topology.faces[face]!.vertices))].sort(
      (a, b) => a - b,
    );
    const boundary = topology.edges.flatMap((edge) => {
      const uses = edge.uses.filter((use) => regionByFace.get(use.faceIndex) === index);
      return (uses.length === 1 && edge.uses.length !== 2) ||
        (uses.length === 1 && edge.uses.some((use) => regionByFace.get(use.faceIndex) !== index))
        ? [[edge.vertexA, edge.vertexB] as [number, number]]
        : [];
    });
    const errors = vertices.map((vertexIndex) =>
      Math.abs(dot(normal, vertex(mesh, vertexIndex)) - constantMm),
    );
    return {
      id: `prepared-panel-${index + 1}`,
      sourceFaceIndices: faces,
      sourceVertexIndices: vertices,
      boundaryLoops: traceRegionBoundary(boundary),
      plane: { normal, constantMm },
      maximumPlanarityErrorMm: Math.max(...errors, 0),
    };
  });
  const errors = panels.flatMap((panel) => [panel.maximumPlanarityErrorMm]);
  return {
    sourceMesh: mesh,
    panels,
    metrics: {
      sourceTriangleCount: topology.faces.length,
      outputPanelCount: panels.length,
      maximumDeviationMm: Math.max(...errors, 0),
      rmsDeviationMm: Math.sqrt(
        errors.reduce((sum, error) => sum + error * error, 0) / Math.max(1, errors.length),
      ),
      volumeDeltaPercent: 0,
    },
    algorithmVersion: PREPARED_MESH_ALGORITHM_VERSION,
  };
}
