import type { SerializableTriangleMesh, Vector3Mm } from '../../domain/geometry';
import type { SurfacePatchClassification } from '../../domain/surfacePatch';

interface FaceGeometry {
  normal: Vector3Mm;
  area: number;
}

function vertex(mesh: SerializableTriangleMesh, index: number): Vector3Mm {
  return [
    mesh.positionsMm[index * 3]!,
    mesh.positionsMm[index * 3 + 1]!,
    mesh.positionsMm[index * 3 + 2]!,
  ];
}

function subtract(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vector3Mm, b: Vector3Mm): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vector3Mm, b: Vector3Mm): Vector3Mm {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function length(vector: Vector3Mm): number {
  return Math.hypot(...vector);
}

function normalize(vector: Vector3Mm): Vector3Mm {
  const magnitude = length(vector);
  return magnitude === 0
    ? [0, 0, 0]
    : [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
}

function angleBetween(a: Vector3Mm, b: Vector3Mm): number {
  return Math.acos(Math.max(-1, Math.min(1, dot(normalize(a), normalize(b)))));
}

function faceGeometry(mesh: SerializableTriangleMesh): FaceGeometry[] {
  const result: FaceGeometry[] = [];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const a = vertex(mesh, mesh.indices[index]!);
    const b = vertex(mesh, mesh.indices[index + 1]!);
    const c = vertex(mesh, mesh.indices[index + 2]!);
    const areaVector = cross(subtract(b, a), subtract(c, a));
    result.push({ normal: normalize(areaVector), area: length(areaVector) / 2 });
  }
  return result;
}

function cornerAngle(center: Vector3Mm, a: Vector3Mm, b: Vector3Mm): number {
  return angleBetween(subtract(a, center), subtract(b, center));
}

function curvatureAndEdges(mesh: SerializableTriangleMesh, faces: FaceGeometry[]) {
  const angleSums = Array.from({ length: mesh.positionsMm.length / 3 }, () => 0);
  const edgeFaces = new Map<string, number[]>();
  for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
    const triangle = mesh.indices.slice(faceIndex * 3, faceIndex * 3 + 3);
    for (let corner = 0; corner < 3; corner += 1) {
      const centerIndex = triangle[corner]!;
      angleSums[centerIndex]! += cornerAngle(
        vertex(mesh, centerIndex),
        vertex(mesh, triangle[(corner + 1) % 3]!),
        vertex(mesh, triangle[(corner + 2) % 3]!),
      );
      const a = Math.min(centerIndex, triangle[(corner + 1) % 3]!);
      const b = Math.max(centerIndex, triangle[(corner + 1) % 3]!);
      const key = `${a}:${b}`;
      const adjacent = edgeFaces.get(key) ?? [];
      if (!adjacent.includes(faceIndex)) adjacent.push(faceIndex);
      edgeFaces.set(key, adjacent);
    }
  }
  const boundaryVertices = new Set<number>();
  let interiorEdges = 0;
  let sharpEdges = 0;
  for (const [key, adjacent] of edgeFaces) {
    if (adjacent.length === 1) {
      key.split(':').forEach((value) => boundaryVertices.add(Number(value)));
    } else if (adjacent.length === 2) {
      interiorEdges += 1;
      if (
        angleBetween(faces[adjacent[0]!]!.normal, faces[adjacent[1]!]!.normal) >
        (25 * Math.PI) / 180
      ) {
        sharpEdges += 1;
      }
    }
  }
  const interiorDefects = angleSums
    .filter((_, index) => !boundaryVertices.has(index))
    .map((sum) => Math.abs(Math.PI * 2 - sum));
  return {
    maximumGaussianCurvature: Math.max(...interiorDefects, 0),
    sharpEdgeRatio: sharpEdges / Math.max(1, interiorEdges),
  };
}

function dominantAxis(mesh: SerializableTriangleMesh): { index: 0 | 1 | 2; vector: Vector3Mm } {
  const extents = ([0, 1, 2] as const).map((axis) => {
    const values = Array.from(
      { length: mesh.positionsMm.length / 3 },
      (_, index) => mesh.positionsMm[index * 3 + axis]!,
    );
    return Math.max(...values) - Math.min(...values);
  });
  const index = extents.indexOf(Math.max(...extents)) as 0 | 1 | 2;
  const vector: Vector3Mm = [0, 0, 0];
  vector[index] = 1;
  return { index, vector };
}

function endRadiusDifference(mesh: SerializableTriangleMesh, axis: 0 | 1 | 2): number {
  const points = Array.from({ length: mesh.positionsMm.length / 3 }, (_, index) =>
    vertex(mesh, index),
  );
  const axialValues = points.map((point) => point[axis]);
  const minimum = Math.min(...axialValues);
  const maximum = Math.max(...axialValues);
  const threshold = (maximum - minimum) * 0.2;
  const transverseAxes = ([0, 1, 2] as const).filter((candidate) => candidate !== axis);
  const center = transverseAxes.map(
    (transverseAxis) =>
      points.reduce((sum, point) => sum + point[transverseAxis], 0) / points.length,
  );
  const meanRadius = (selected: Vector3Mm[]) =>
    selected.reduce(
      (sum, point) =>
        sum +
        Math.hypot(point[transverseAxes[0]!] - center[0]!, point[transverseAxes[1]!] - center[1]!),
      0,
    ) / Math.max(1, selected.length);
  const lowRadius = meanRadius(points.filter((point) => point[axis] <= minimum + threshold));
  const highRadius = meanRadius(points.filter((point) => point[axis] >= maximum - threshold));
  return Math.abs(highRadius - lowRadius) / Math.max(lowRadius, highRadius, 1e-9);
}

export function classifySurfacePatch(mesh: SerializableTriangleMesh): SurfacePatchClassification {
  const faces = faceGeometry(mesh);
  const totalArea = faces.reduce((sum, face) => sum + face.area, 0);
  const averageNormal = normalize(
    faces.reduce<Vector3Mm>(
      (sum, face) => [
        sum[0] + face.normal[0] * face.area,
        sum[1] + face.normal[1] * face.area,
        sum[2] + face.normal[2] * face.area,
      ],
      [0, 0, 0],
    ),
  );
  const normalSpreadDeg =
    (Math.max(...faces.map((face) => angleBetween(face.normal, averageNormal)), 0) * 180) / Math.PI;
  const { maximumGaussianCurvature, sharpEdgeRatio } = curvatureAndEdges(mesh, faces);
  const axis = dominantAxis(mesh);
  const base = { maximumGaussianCurvature, normalSpreadDeg, sharpEdgeRatio };

  if (totalArea === 0 || faces.length === 0) {
    return { ...base, kind: 'faceted', confidence: 0, flatteningStrategy: 'unsupported' };
  }
  if (normalSpreadDeg <= 1) {
    return { ...base, kind: 'planar', confidence: 1, flatteningStrategy: 'planar' };
  }
  if (sharpEdgeRatio >= 0.2) {
    return {
      ...base,
      kind: 'faceted',
      confidence: Math.min(1, sharpEdgeRatio * 2),
      flatteningStrategy: 'triangulated',
    };
  }
  if (maximumGaussianCurvature > 0.005) {
    return {
      ...base,
      kind: 'compound-curved',
      confidence: Math.min(1, maximumGaussianCurvature / 0.1),
      flatteningStrategy: 'unsupported',
    };
  }
  const radiusDifference = endRadiusDifference(mesh, axis.index);
  if (radiusDifference <= 0.02) {
    return {
      ...base,
      kind: 'cylindrical',
      confidence: 1 - radiusDifference,
      estimatedAxis: axis.vector,
      flatteningStrategy: 'analytic',
    };
  }
  if (radiusDifference >= 0.08) {
    return {
      ...base,
      kind: 'conical',
      confidence: Math.min(1, radiusDifference * 4),
      estimatedAxis: axis.vector,
      flatteningStrategy: 'analytic',
    };
  }
  return {
    ...base,
    kind: 'developable-strip',
    confidence: 0.6,
    estimatedAxis: axis.vector,
    flatteningStrategy: 'triangulated',
  };
}
