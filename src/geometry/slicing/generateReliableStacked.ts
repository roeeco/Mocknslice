import { canonicalSliceContours } from './canonicalSliceContours';
import { signedArea, pointInPolygon as contained } from '../designGraph/polygons';
import type { Point2D } from '../../domain/geometry';
import type { StackedSliceInput, StackedSliceResult } from './types';
import { generateStackedSlices } from './generateStackedSlices';
import { createSlicePlanes } from './createSlicePlanes';
import { canonicalizeContours, outputIssue } from '../output/canonicalizeContours';
import { pointInPolygon } from '../designGraph/polygons';
import { EPS_LENGTH_MM } from '../designGraph/tolerances';
const distance = (p: Point2D, a: Point2D, b: Point2D) => {
  const l = (b.x - a.x) ** 2 + (b.y - a.y) ** 2,
    t = l
      ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l))
      : 0;
  return Math.hypot(p.x - a.x - t * (b.x - a.x), p.y - a.y - t * (b.y - a.y));
};
export function generateReliableStacked(input: StackedSliceInput): StackedSliceResult {
  const { settings, bounds } = input,
    index = { x: 0, y: 1, z: 2 }[settings.axis],
    start = bounds.minMm[index]!;
  if (
    !Number.isFinite(settings.spacingMm) ||
    settings.spacingMm <= 0 ||
    (bounds.maxMm[index]! - start) / settings.spacingMm > 10000
  )
    return {
      parts: [],
      issues: [
        outputIssue(
          'SLICE_COMPLEXITY_LIMIT',
          [],
          'Slice count exceeds the supported 10,000-plane bound.',
        ),
      ],
      planePositionsMm: [],
      algorithmVersion: 'closed-stacked-v2',
    };
  let planes = createSlicePlanes(bounds, settings.axis, settings.spacingMm);
  if (settings.firstLayerOffsetMm !== undefined) {
    if (
      !Number.isFinite(settings.firstLayerOffsetMm) ||
      settings.firstLayerOffsetMm < 0 ||
      settings.firstLayerOffsetMm >= bounds.maxMm[index]! - start
    )
      return {
        parts: [],
        planePositionsMm: [],
        algorithmVersion: 'closed-stacked-v2',
        issues: [
          outputIssue(
            'SLICE_FIRST_POSITION_INVALID',
            [],
            'First slice offset must lie within the model extent.',
          ),
        ],
      };
    planes = [];
    for (
      let p = start + settings.firstLayerOffsetMm;
      p < bounds.maxMm[index]!;
      p += settings.spacingMm
    )
      planes.push(p);
  }
  const legacy = generateStackedSlices(input, { planePositionsMm: planes });
  const resolved = new Set<number>();
  for (let planeIndex = 0; planeIndex < planes.length; planeIndex++) {
    if (
      !legacy.issues.some(
        (issue) =>
          issue.id === `slice-open-${planeIndex}` || issue.id === `slice-ambiguous-${planeIndex}`,
      )
    )
      continue;
    const loops = canonicalSliceContours(
      input.mesh,
      settings.axis,
      planes[planeIndex]!,
      settings.contourEpsilonMm,
    );
    if (!loops?.length) continue;
    const outers = loops.filter((loop) => signedArea(loop) > 0),
      holes = loops.filter((loop) => signedArea(loop) < 0);
    legacy.parts = legacy.parts.filter((part) => part.slice?.planeIndex !== planeIndex);
    outers.forEach((loop, islandIndex) => {
      const id = `slice-${settings.axis}-${planeIndex + 1}-${islandIndex + 1}`;
      legacy.parts.push({
        id,
        name: `Slice ${settings.axis.toUpperCase()}${planeIndex + 1}`,
        label: `${settings.axis.toUpperCase()}${planeIndex + 1}`,
        thicknessMm: settings.thicknessMm,
        sourceReference: input.modelId,
        slice: { axis: settings.axis, positionMm: planes[planeIndex]!, planeIndex },
        paths: [
          { id: `${id}-outer`, operation: 'cut', closed: true, contourRole: 'outer', points: loop },
          ...holes
            .filter((h) => contained(h[0]!, loop, false))
            .map((hole, i) => ({
              id: `${id}-hole-${i + 1}`,
              operation: 'cut' as const,
              closed: true,
              contourRole: 'hole' as const,
              points: hole,
            })),
        ],
      });
    });
    resolved.add(planeIndex);
  }
  legacy.parts.sort(
    (a, b) => (a.slice?.planeIndex ?? 0) - (b.slice?.planeIndex ?? 0) || (a.id < b.id ? -1 : 1),
  );
  const canonical = canonicalizeContours(legacy.parts),
    issues = [
      ...legacy.issues
        .filter(
          (issue) =>
            ![...resolved].some(
              (i) => issue.id === `slice-open-${i}` || issue.id === `slice-ambiguous-${i}`,
            ),
        )
        .map((issue) =>
          [
            'OPEN_SLICE_CONTOUR',
            'AMBIGUOUS_SLICE_GRAPH',
            'SLICE_THICKNESS_EXCEEDS_SPACING',
          ].includes(issue.code)
            ? { ...issue, severity: 'error' as const }
            : issue,
        ),
      ...canonical.issues,
    ],
    feature = settings.registrationHoles;
  if (feature) {
    const axes = settings.axis === 'x' ? [2, 1] : settings.axis === 'y' ? [0, 2] : [0, 1],
      radius = feature.diameterMm / 2;
    const centres = feature.centres.map((p) => ({
      x: bounds.minMm[axes[0]!]! + p.x * (bounds.maxMm[axes[0]!]! - bounds.minMm[axes[0]!]!),
      y: bounds.minMm[axes[1]!]! + p.y * (bounds.maxMm[axes[1]!]! - bounds.minMm[axes[1]!]!),
    }));
    for (const part of canonical.parts) {
      const loops = part.paths.filter((p) => p.operation === 'cut' && p.closed),
        outer = loops.find((p) => p.contourRole === 'outer')!,
        ligament = 2 * part.thicknessMm;
      const valid =
        Number.isFinite(radius) &&
        radius > 0 &&
        centres.length === 2 &&
        centres.every(
          (p) =>
            Number.isFinite(p.x) &&
            Number.isFinite(p.y) &&
            pointInPolygon(p, outer.points, false) &&
            !loops.some((l) => l.contourRole === 'hole' && pointInPolygon(p, l.points)) &&
            loops.every((l) =>
              l.points.every(
                (a, i) =>
                  distance(p, a, l.points[(i + 1) % l.points.length]!) >=
                  radius + ligament - EPS_LENGTH_MM,
              ),
            ),
        ) &&
        Math.hypot(centres[0]!.x - centres[1]!.x, centres[0]!.y - centres[1]!.y) >=
          2 * radius + ligament - EPS_LENGTH_MM;
      if (!valid) {
        issues.push(
          outputIssue(
            'REGISTRATION_HOLE_OUTSIDE_PART',
            [part.id, feature.id],
            'Registration holes require full containment and a two-stock-thickness ligament on every participating piece.',
          ),
        );
        continue;
      }
      centres.forEach((centre, i) =>
        part.paths.push({
          id: `${part.id}-${feature.id}-${i + 1}`,
          operation: 'cut',
          closed: true,
          contourRole: 'hole',
          featureId: `${feature.id}-${i + 1}`,
          points: Array.from({ length: 32 }, (_, j) => {
            const angle = (-j * 2 * Math.PI) / 32;
            return {
              x: centre.x + radius * Math.cos(angle),
              y: centre.y + radius * Math.sin(angle),
            };
          }),
        }),
      );
    }
  }
  return { ...legacy, parts: canonical.parts, issues, algorithmVersion: 'closed-stacked-v2' };
}
