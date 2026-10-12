import type { PapercraftPanel } from '../../domain/papercraft';
import type { SerializableTriangleMesh, Vector3Mm } from '../../domain/geometry';
import { mergePlanarRegions } from '../mesh/mergePlanarRegions';
import { meshVertex } from '../unfolding/meshAdjacency';
import { isSimplePolygon } from '../designGraph/polygons';

/** Validated planar patches are metadata; triangles remain exact collision primitives. */
export function panelizePapercraft(
  mesh: SerializableTriangleMesh,
  merge: boolean,
): PapercraftPanel[] {
  if (!merge)
    return Array.from({ length: mesh.indices.length / 3 }, (_, i) => ({
      id: `panel-${i}`,
      faceIds: [`face-${i}`],
      boundaryVertexIds: mesh.indices.slice(i * 3, i * 3 + 3),
      verified: true,
    }));
  const prepared = mergePlanarRegions(mesh, 0.01, 2);
  return prepared.panels.flatMap((panel) => {
    const loop = panel.boundaryLoops[0];
    if (panel.boundaryLoops.length === 1 && loop && panel.maximumPlanarityErrorMm <= 0.01) {
      const origin = meshVertex(mesh, loop[0]!),
        next = meshVertex(mesh, loop[1]!);
      const len = Math.hypot(...next.map((v, i) => v - origin[i]!));
      const u: Vector3Mm = next.map((v, i) => (v - origin[i]!) / len) as Vector3Mm,
        n = panel.plane.normal;
      const v: Vector3Mm = [
        n[1] * u[2] - n[2] * u[1],
        n[2] * u[0] - n[0] * u[2],
        n[0] * u[1] - n[1] * u[0],
      ];
      const points = loop.map((index) => {
        const p = meshVertex(mesh, index).map((x, i) => x - origin[i]!);
        return {
          x: p.reduce((s, x, i) => s + x * u[i]!, 0),
          y: p.reduce((s, x, i) => s + x * v[i]!, 0),
        };
      });
      if (isSimplePolygon(points))
        return [
          {
            id: panel.id,
            faceIds: panel.sourceFaceIndices.map((i) => `face-${i}`),
            boundaryVertexIds: [...loop],
            verified: true,
          },
        ];
    }
    return panel.sourceFaceIndices.map((i) => ({
      id: `panel-face-${i}`,
      faceIds: [`face-${i}`],
      boundaryVertexIds: mesh.indices.slice(i * 3, i * 3 + 3),
      verified: true,
    }));
  });
}
