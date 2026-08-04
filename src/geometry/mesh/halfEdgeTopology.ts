import type { SerializableTriangleMesh } from '../../domain/geometry';
import { buildMeshTopology } from '../unfolding/meshAdjacency';

/** Pure topology adapter shared by preparation and panel unfolding. */
export function buildHalfEdgeTopology(mesh: SerializableTriangleMesh) {
  return buildMeshTopology(mesh);
}
