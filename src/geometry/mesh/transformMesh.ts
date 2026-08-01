import type { SerializableTriangleMesh } from '../../domain/geometry';
import type { ModelAxis, ModelData } from '../../domain/model';
import { calculateBounds, dimensionsFromBounds } from './normalizeMesh';
import { validateMeshTopology } from './validateMesh';

function mapPositions(
  mesh: SerializableTriangleMesh,
  transform: (x: number, y: number, z: number) => [number, number, number],
): SerializableTriangleMesh {
  const positionsMm: number[] = [];
  for (let index = 0; index < mesh.positionsMm.length; index += 3) {
    positionsMm.push(
      ...transform(
        mesh.positionsMm[index] ?? 0,
        mesh.positionsMm[index + 1] ?? 0,
        mesh.positionsMm[index + 2] ?? 0,
      ),
    );
  }
  return { positionsMm, indices: [...mesh.indices] };
}

function withMesh(model: ModelData, mesh: SerializableTriangleMesh): ModelData {
  const bounds = calculateBounds(mesh.positionsMm);
  const weldedVertexCount = mesh.positionsMm.length / 3;
  return {
    ...model,
    mesh,
    bounds,
    dimensions: dimensionsFromBounds(bounds),
    healthReport: validateMeshTopology(mesh, weldedVertexCount),
  };
}

export function rotateModelMesh90(model: ModelData, axis: ModelAxis): ModelData {
  if (!model.mesh) return model;
  const mesh = mapPositions(model.mesh, (x, y, z) => {
    if (axis === 'x') return [x, -z, y];
    if (axis === 'y') return [z, y, -x];
    return [-y, x, z];
  });
  return withMesh(model, mesh);
}

export function scaleModelMeshToDimension(
  model: ModelData,
  axis: ModelAxis,
  targetMm: number,
): ModelData {
  if (!model.mesh || !Number.isFinite(targetMm) || targetMm <= 0) return model;
  const current =
    axis === 'x'
      ? model.dimensions.widthMm
      : axis === 'y'
        ? model.dimensions.heightMm
        : model.dimensions.depthMm;
  if (current <= 0) return model;
  const ratio = targetMm / current;
  const scaled = withMesh(
    model,
    mapPositions(model.mesh, (x, y, z) => [x * ratio, y * ratio, z * ratio]),
  );
  if (!model.importSettings) return scaled;
  return {
    ...scaled,
    importSettings: {
      ...model.importSettings,
      dimensionScale: model.importSettings.dimensionScale * ratio,
    },
  };
}
