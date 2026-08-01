import type { SerializableTriangleMesh, Vector3Mm } from '../../domain/geometry';

export interface TopologyFace {
  index: number;
  vertices: [number, number, number];
  normal: Vector3Mm;
}

export interface TopologyEdgeUse {
  faceIndex: number;
  startVertex: number;
  endVertex: number;
}

export interface TopologyEdge {
  key: string;
  vertexA: number;
  vertexB: number;
  uses: TopologyEdgeUse[];
  lengthMm: number;
  dihedralDeg?: number;
}

export interface MeshTopology {
  faces: TopologyFace[];
  edges: TopologyEdge[];
  boundaryEdgeCount: number;
  nonManifoldEdgeCount: number;
  orientationIssueCount: number;
}

export function meshVertex(mesh: SerializableTriangleMesh, index: number): Vector3Mm {
  return [
    mesh.positionsMm[index * 3] ?? 0,
    mesh.positionsMm[index * 3 + 1] ?? 0,
    mesh.positionsMm[index * 3 + 2] ?? 0,
  ];
}

function subtract(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vector3Mm, b: Vector3Mm): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalized(vector: Vector3Mm): Vector3Mm {
  const length = Math.hypot(...vector);
  return length > 1e-12 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [0, 0, 0];
}

function faceNormal(mesh: SerializableTriangleMesh, vertices: [number, number, number]): Vector3Mm {
  const a = meshVertex(mesh, vertices[0]);
  const b = meshVertex(mesh, vertices[1]);
  const c = meshVertex(mesh, vertices[2]);
  return normalized(cross(subtract(b, a), subtract(c, a)));
}

export function meshEdgeKey(first: number, second: number): string {
  return first < second ? `${first}:${second}` : `${second}:${first}`;
}

export function buildMeshTopology(mesh: SerializableTriangleMesh): MeshTopology {
  const faces: TopologyFace[] = [];
  const edgesByKey = new Map<string, TopologyEdge>();
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const vertices: [number, number, number] = [
      mesh.indices[offset] ?? 0,
      mesh.indices[offset + 1] ?? 0,
      mesh.indices[offset + 2] ?? 0,
    ];
    const faceIndex = offset / 3;
    faces.push({ index: faceIndex, vertices, normal: faceNormal(mesh, vertices) });
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
      const startVertex = vertices[edgeIndex]!;
      const endVertex = vertices[(edgeIndex + 1) % 3]!;
      const key = meshEdgeKey(startVertex, endVertex);
      const existing = edgesByKey.get(key);
      if (existing) {
        existing.uses.push({ faceIndex, startVertex, endVertex });
      } else {
        const first = meshVertex(mesh, startVertex);
        const second = meshVertex(mesh, endVertex);
        edgesByKey.set(key, {
          key,
          vertexA: Math.min(startVertex, endVertex),
          vertexB: Math.max(startVertex, endVertex),
          uses: [{ faceIndex, startVertex, endVertex }],
          lengthMm: Math.hypot(second[0] - first[0], second[1] - first[1], second[2] - first[2]),
        });
      }
    }
  }
  const edges = [...edgesByKey.values()].sort((a, b) =>
    a.vertexA === b.vertexA ? a.vertexB - b.vertexB : a.vertexA - b.vertexA,
  );
  for (const edge of edges) {
    if (edge.uses.length !== 2) continue;
    const firstNormal = faces[edge.uses[0]!.faceIndex]!.normal;
    const secondNormal = faces[edge.uses[1]!.faceIndex]!.normal;
    edge.dihedralDeg =
      (Math.acos(Math.max(-1, Math.min(1, dot(firstNormal, secondNormal)))) * 180) / Math.PI;
  }
  return {
    faces,
    edges,
    boundaryEdgeCount: edges.filter((edge) => edge.uses.length === 1).length,
    nonManifoldEdgeCount: edges.filter((edge) => edge.uses.length > 2).length,
    orientationIssueCount: edges.filter(
      (edge) =>
        edge.uses.length === 2 &&
        edge.uses[0]!.startVertex === edge.uses[1]!.startVertex &&
        edge.uses[0]!.endVertex === edge.uses[1]!.endVertex,
    ).length,
  };
}
