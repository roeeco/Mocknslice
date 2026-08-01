import type { Point2D } from '../../domain/geometry';
import type { ClassifiedContour, SliceContour } from './types';

export function signedArea(points: Point2D[]): number {
  return (
    points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length] ?? point;
      return area + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index]!;
    const b = polygon[previous]!;
    const crosses = a.y > point.y !== b.y > point.y;
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function classifyContours(contours: SliceContour[]): ClassifiedContour[] {
  const closed = contours.filter((contour) => contour.closed && contour.points.length >= 3);
  const raw = closed.map((contour, originalIndex) => {
    const probe = contour.points[0]!;
    const containing = closed
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(
        ({ candidateIndex, candidate }) =>
          candidateIndex !== originalIndex &&
          Math.abs(signedArea(candidate.points)) > Math.abs(signedArea(contour.points)) &&
          pointInPolygon(probe, candidate.points),
      );
    return { contour, role: containing.length % 2 === 0 ? ('outer' as const) : ('hole' as const) };
  });

  const classified: ClassifiedContour[] = raw.map(({ contour, role }) => {
    const area = signedArea(contour.points);
    const shouldReverse = role === 'outer' ? area < 0 : area > 0;
    return {
      ...contour,
      role,
      points: shouldReverse ? [...contour.points].reverse() : contour.points,
    };
  });

  classified.forEach((contour) => {
    if (contour.role !== 'hole') return;
    const candidates = classified
      .map((candidate, index) => ({ candidate, index }))
      .filter(
        ({ candidate }) =>
          candidate.role === 'outer' && pointInPolygon(contour.points[0]!, candidate.points),
      )
      .sort(
        (a, b) =>
          Math.abs(signedArea(a.candidate.points)) - Math.abs(signedArea(b.candidate.points)),
      );
    const parent = candidates[0]?.index;
    if (parent !== undefined) contour.parentOuterIndex = parent;
  });
  return classified;
}
