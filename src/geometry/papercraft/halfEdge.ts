import type { PapercraftHalfEdge, PapercraftSourceFace } from '../../domain/papercraft';
import type { SerializableTriangleMesh, Vector3Mm } from '../../domain/geometry';
import { buildMeshTopology, meshVertex } from '../unfolding/meshAdjacency';

const cross = (a: Vector3Mm, b: Vector3Mm): Vector3Mm => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vector3Mm, b: Vector3Mm) => a.reduce((sum, value, i) => sum + value * b[i]!, 0);
/** A is the lower face index; u follows A's source winding. Reversing A/B retains the physical sign. */
export function papercraftHalfEdges(mesh: SerializableTriangleMesh) {
  const topology = buildMeshTopology(mesh);
  const faces: PapercraftSourceFace[] = topology.faces.map((face) => ({
    id: `face-${face.index}`,
    index: face.index,
    vertexIds: face.vertices,
    normal: face.normal,
    sourceFaceIds: [`face-${face.index}`],
  }));
  const halfEdges: PapercraftHalfEdge[] = [];
  for (const edge of topology.edges) {
    const uses = [...edge.uses].sort((a, b) => a.faceIndex - b.faceIndex);
    let angle: number | undefined;
    if (uses.length === 2) {
      const a = meshVertex(mesh, uses[0]!.startVertex),
        b = meshVertex(mesh, uses[0]!.endVertex);
      const u: Vector3Mm = [
        (b[0] - a[0]) / edge.lengthMm,
        (b[1] - a[1]) / edge.lengthMm,
        (b[2] - a[2]) / edge.lengthMm,
      ];
      const nA = faces[uses[0]!.faceIndex]!.normal,
        nB = faces[uses[1]!.faceIndex]!.normal;
      angle = (Math.atan2(dot(u, cross(nA, nB)), dot(nA, nB)) * 180) / Math.PI;
    }
    for (const use of uses) {
      const face = faces[use.faceIndex]!,
        local = face.vertexIds.indexOf(use.startVertex);
      const opposite = uses.find((other) => other.faceIndex !== use.faceIndex);
      halfEdges.push({
        id: `${face.id}:${local}`,
        edgeKey: edge.key,
        faceId: face.id,
        faceIndex: face.index,
        startVertex: use.startVertex,
        endVertex: use.endVertex,
        nextId: `${face.id}:${(local + 1) % 3}`,
        ...(opposite
          ? {
              oppositeId: `face-${opposite.faceIndex}:${faces[opposite.faceIndex]!.vertexIds.indexOf(opposite.startVertex)}`,
            }
          : {}),
        lengthMm: edge.lengthMm,
        ...(angle === undefined ? {} : { signedDihedralDeg: angle }),
        joinable: uses.length === 2 && use.startVertex === opposite?.endVertex,
        softCoplanar: false,
      });
    }
  }
  return {
    faces,
    halfEdges: halfEdges.sort((a, b) => a.faceIndex - b.faceIndex || a.id.localeCompare(b.id)),
  };
}
