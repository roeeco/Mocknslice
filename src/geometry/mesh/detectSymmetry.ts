import type { SerializableTriangleMesh } from '../../domain/geometry';

export interface SymmetryResult {
  axis: 'x' | 'y' | 'z';
  planeMm: number;
  maximumErrorMm: number;
}

export function detectSymmetry(mesh: SerializableTriangleMesh): SymmetryResult[] {
  return (['x', 'y', 'z'] as const).map((axis, axisIndex) => {
    const values = mesh.positionsMm.filter((_, index) => index % 3 === axisIndex);
    const planeMm = (Math.min(...values) + Math.max(...values)) / 2;
    let maximumErrorMm = 0;
    for (let vertex = 0; vertex < mesh.positionsMm.length; vertex += 3) {
      const point = [
        mesh.positionsMm[vertex]!,
        mesh.positionsMm[vertex + 1]!,
        mesh.positionsMm[vertex + 2]!,
      ];
      const reflected = [...point];
      reflected[axisIndex] = 2 * planeMm - reflected[axisIndex]!;
      const nearest = Array.from({ length: mesh.positionsMm.length / 3 }, (_, candidate) =>
        Math.hypot(
          reflected[0]! - mesh.positionsMm[candidate * 3]!,
          reflected[1]! - mesh.positionsMm[candidate * 3 + 1]!,
          reflected[2]! - mesh.positionsMm[candidate * 3 + 2]!,
        ),
      ).reduce((best, distance) => Math.min(best, distance), Infinity);
      maximumErrorMm = Math.max(maximumErrorMm, nearest);
    }
    return { axis, planeMm, maximumErrorMm };
  });
}
