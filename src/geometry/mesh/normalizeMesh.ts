import type {
  Bounds3D,
  Dimensions3D,
  SerializableTriangleMesh,
  Vector3Mm,
} from '../../domain/geometry';
import type { ModelHealthReport, ModelImportSettings, StlUnit } from '../../domain/model';
import { validateMeshTopology } from './validateMesh';

export interface TriangleSoup {
  positions: number[];
}

export interface NormalizeMeshOptions {
  assumedUnit: StlUnit;
  mergeToleranceMm?: number;
  zeroAreaToleranceMm2?: number;
}

export interface NormalizedMeshResult {
  mesh: SerializableTriangleMesh;
  bounds: Bounds3D;
  dimensions: Dimensions3D;
  healthReport: ModelHealthReport;
  importSettings: ModelImportSettings;
}

const UNIT_TO_MM: Record<StlUnit, number> = {
  millimetres: 1,
  centimetres: 10,
  metres: 1000,
  inches: 25.4,
};

function crossMagnitudeSquared(points: number[]): number {
  const [ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0, cx = 0, cy = 0, cz = 0] = points;
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const crossX = aby * acz - abz * acy;
  const crossY = abz * acx - abx * acz;
  const crossZ = abx * acy - aby * acx;
  return crossX * crossX + crossY * crossY + crossZ * crossZ;
}

function calculateBounds(positionsMm: number[]): Bounds3D {
  const min: Vector3Mm = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: Vector3Mm = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];

  for (let index = 0; index < positionsMm.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positionsMm[index + axis];
      if (value === undefined) throw new Error('Mesh positions must contain complete vertices.');
      min[axis] = Math.min(min[axis] ?? Number.POSITIVE_INFINITY, value);
      max[axis] = Math.max(max[axis] ?? Number.NEGATIVE_INFINITY, value);
    }
  }

  return { minMm: min, maxMm: max };
}

function dimensionsFromBounds(bounds: Bounds3D): Dimensions3D {
  return {
    widthMm: bounds.maxMm[0] - bounds.minMm[0],
    heightMm: bounds.maxMm[1] - bounds.minMm[1],
    depthMm: bounds.maxMm[2] - bounds.minMm[2],
  };
}

function cellKey(x: number, y: number, z: number, tolerance: number): string {
  return `${Math.floor(x / tolerance)},${Math.floor(y / tolerance)},${Math.floor(z / tolerance)}`;
}

function compactMesh(positionsMm: number[], indices: number[]): SerializableTriangleMesh {
  const remap = new Map<number, number>();
  const compactPositions: number[] = [];
  const compactIndices = indices.map((oldIndex) => {
    const existing = remap.get(oldIndex);
    if (existing !== undefined) return existing;
    const nextIndex = remap.size;
    remap.set(oldIndex, nextIndex);
    compactPositions.push(
      positionsMm[oldIndex * 3] ?? 0,
      positionsMm[oldIndex * 3 + 1] ?? 0,
      positionsMm[oldIndex * 3 + 2] ?? 0,
    );
    return nextIndex;
  });
  return { positionsMm: compactPositions, indices: compactIndices };
}

export function normalizeMesh(
  soup: TriangleSoup,
  options: NormalizeMeshOptions,
): NormalizedMeshResult {
  if (soup.positions.length === 0 || soup.positions.length % 9 !== 0) {
    throw new Error('STL geometry must contain complete triangles.');
  }
  if (!soup.positions.every(Number.isFinite)) {
    throw new Error('STL geometry contains a non-finite coordinate.');
  }

  const sourceUnitToMm = UNIT_TO_MM[options.assumedUnit];
  const mergeToleranceMm = options.mergeToleranceMm ?? 1e-5;
  const zeroAreaToleranceMm2 = options.zeroAreaToleranceMm2 ?? mergeToleranceMm ** 2;
  if (mergeToleranceMm <= 0 || zeroAreaToleranceMm2 < 0) {
    throw new Error('Mesh tolerances must be positive.');
  }

  const weldedPositions: number[] = [];
  const indices: number[] = [];
  const buckets = new Map<string, number[]>();
  let removedZeroAreaTriangleCount = 0;

  const findOrCreateVertex = (x: number, y: number, z: number): number => {
    const cellX = Math.floor(x / mergeToleranceMm);
    const cellY = Math.floor(y / mergeToleranceMm);
    const cellZ = Math.floor(z / mergeToleranceMm);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const candidates = buckets.get(`${cellX + dx},${cellY + dy},${cellZ + dz}`) ?? [];
          for (const candidate of candidates) {
            const offset = candidate * 3;
            const px = weldedPositions[offset] ?? 0;
            const py = weldedPositions[offset + 1] ?? 0;
            const pz = weldedPositions[offset + 2] ?? 0;
            const distanceSquared = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
            if (distanceSquared <= mergeToleranceMm ** 2) return candidate;
          }
        }
      }
    }
    const index = weldedPositions.length / 3;
    weldedPositions.push(x, y, z);
    const key = cellKey(x, y, z, mergeToleranceMm);
    buckets.set(key, [...(buckets.get(key) ?? []), index]);
    return index;
  };

  for (let offset = 0; offset < soup.positions.length; offset += 9) {
    const triangle = soup.positions
      .slice(offset, offset + 9)
      .map((coordinate) => coordinate * sourceUnitToMm);
    if (crossMagnitudeSquared(triangle) <= zeroAreaToleranceMm2 ** 2) {
      removedZeroAreaTriangleCount += 1;
      continue;
    }
    const triangleIndices = [
      findOrCreateVertex(triangle[0] ?? 0, triangle[1] ?? 0, triangle[2] ?? 0),
      findOrCreateVertex(triangle[3] ?? 0, triangle[4] ?? 0, triangle[5] ?? 0),
      findOrCreateVertex(triangle[6] ?? 0, triangle[7] ?? 0, triangle[8] ?? 0),
    ];
    if (new Set(triangleIndices).size < 3) {
      removedZeroAreaTriangleCount += 1;
      continue;
    }
    indices.push(...triangleIndices);
  }

  if (indices.length === 0) throw new Error('STL does not contain any usable triangles.');

  const compact = compactMesh(weldedPositions, indices);
  const originalBounds = calculateBounds(compact.positionsMm);
  const centreOffsetMm: Vector3Mm = [
    (originalBounds.minMm[0] + originalBounds.maxMm[0]) / 2,
    (originalBounds.minMm[1] + originalBounds.maxMm[1]) / 2,
    (originalBounds.minMm[2] + originalBounds.maxMm[2]) / 2,
  ];
  compact.positionsMm = compact.positionsMm.map(
    (coordinate, index) => coordinate - (centreOffsetMm[index % 3] ?? 0),
  );
  const bounds = calculateBounds(compact.positionsMm);
  const weldedVertexCount = compact.positionsMm.length / 3;

  return {
    mesh: compact,
    bounds,
    dimensions: dimensionsFromBounds(bounds),
    healthReport: validateMeshTopology(compact, weldedVertexCount),
    importSettings: {
      assumedUnit: options.assumedUnit,
      sourceUnitToMm,
      mergeToleranceMm,
      removedZeroAreaTriangleCount,
      centreOffsetMm,
      dimensionScale: 1,
    },
  };
}

export { calculateBounds, dimensionsFromBounds };
