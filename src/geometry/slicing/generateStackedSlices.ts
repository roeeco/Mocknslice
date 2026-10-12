import type { FabricationPart } from '../../domain/fabrication';
import type { ValidationIssue } from '../../domain/validation';
import { classifyContours } from './classifyContours';
import { createSlicePlanes } from './createSlicePlanes';
import { traceContours } from './traceContours';
import { intersectMeshWithPlane } from './trianglePlaneIntersection';
import type { StackedSliceInput, StackedSliceResult } from './types';

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function generateStackedSlices(
  input: StackedSliceInput,
  options?: { planePositionsMm: number[] },
): StackedSliceResult {
  const { mesh, bounds, settings, modelId } = input;
  if (settings.thicknessMm <= 0 || !Number.isFinite(settings.thicknessMm)) {
    throw new Error('Slice thickness must be greater than zero.');
  }
  const planes =
    options?.planePositionsMm ?? createSlicePlanes(bounds, settings.axis, settings.spacingMm);
  const parts: FabricationPart[] = [];
  const issues: ValidationIssue[] = [];

  if (settings.thicknessMm > settings.spacingMm) {
    issues.push({
      id: 'slice-thickness-overlap',
      severity: 'warning',
      code: 'SLICE_THICKNESS_EXCEEDS_SPACING',
      message: 'Part thickness exceeds slice spacing, so assembled slices will overlap.',
      affectedEntityIds: [modelId],
      suggestedAction: 'Increase spacing or reduce part thickness.',
    });
  }

  planes.forEach((positionMm, planeIndex) => {
    const intersection = intersectMeshWithPlane(
      mesh,
      settings.axis,
      positionMm,
      settings.contourEpsilonMm,
    );
    const traced = traceContours(intersection.segments, settings.contourEpsilonMm);
    const classified = classifyContours(traced.contours);
    const outers = classified
      .map((contour, contourIndex) => ({ contour, contourIndex }))
      .filter(({ contour }) => contour.role === 'outer');

    if (traced.openContourCount > 0) {
      issues.push({
        id: `slice-open-${planeIndex}`,
        severity: 'warning',
        code: 'OPEN_SLICE_CONTOUR',
        message: `Slice ${planeIndex + 1} contains ${traced.openContourCount} open contour${traced.openContourCount === 1 ? '' : 's'} and cannot be fabricated as drawn.`,
        affectedEntityIds: [modelId],
        suggestedAction: 'Repair open mesh edges or adjust the slice position.',
      });
    }
    if (traced.ambiguousNodeCount > 0) {
      issues.push({
        id: `slice-ambiguous-${planeIndex}`,
        severity: 'warning',
        code: 'AMBIGUOUS_SLICE_GRAPH',
        message: `Slice ${planeIndex + 1} has ${traced.ambiguousNodeCount} branching contour node${traced.ambiguousNodeCount === 1 ? '' : 's'}.`,
        affectedEntityIds: [modelId],
        suggestedAction: 'Repair non-manifold geometry before fabrication.',
      });
    }
    if (intersection.coplanarTriangleCount > 0) {
      issues.push({
        id: `slice-coplanar-${planeIndex}`,
        severity: 'info',
        code: 'COPLANAR_SLICE_TRIANGLES',
        message: `Slice ${planeIndex + 1} crosses ${intersection.coplanarTriangleCount} coplanar triangle${intersection.coplanarTriangleCount === 1 ? '' : 's'}.`,
        affectedEntityIds: [modelId],
        suggestedAction: 'Slightly adjust spacing if the contour is incomplete.',
      });
    }
    if (outers.length > 1) {
      issues.push({
        id: `slice-islands-${planeIndex}`,
        severity: 'info',
        code: 'MULTIPLE_SLICE_ISLANDS',
        message: `Slice ${planeIndex + 1} creates ${outers.length} separate parts.`,
        affectedEntityIds: [modelId],
      });
    }

    outers.forEach(({ contour, contourIndex }, islandIndex) => {
      const partId = `slice-${settings.axis}-${planeIndex + 1}-${islandIndex + 1}`;
      const holes = classified.filter(
        (candidate) => candidate.role === 'hole' && candidate.parentOuterIndex === contourIndex,
      );
      parts.push({
        id: partId,
        name: `Slice ${settings.axis.toUpperCase()}${planeIndex + 1}${outers.length > 1 ? `.${islandIndex + 1}` : ''}`,
        label: `${settings.axis.toUpperCase()}${planeIndex + 1}`,
        thicknessMm: settings.thicknessMm,
        sourceReference: modelId,
        slice: { axis: settings.axis, positionMm: rounded(positionMm), planeIndex },
        paths: [
          {
            id: `${partId}-outer`,
            operation: 'cut',
            closed: true,
            contourRole: 'outer',
            points: contour.points.map((point) => ({ x: rounded(point.x), y: rounded(point.y) })),
          },
          ...holes.map((hole, holeIndex) => ({
            id: `${partId}-hole-${holeIndex + 1}`,
            operation: 'cut' as const,
            closed: true,
            contourRole: 'hole' as const,
            points: hole.points.map((point) => ({ x: rounded(point.x), y: rounded(point.y) })),
          })),
        ],
      });
    });
  });

  if (parts.length === 0) {
    issues.push({
      id: 'slice-no-parts',
      severity: 'error',
      code: 'NO_CLOSED_SLICES',
      message: 'No closed slice contours could be generated from this model.',
      affectedEntityIds: [modelId],
      suggestedAction: 'Repair the mesh or try another slice axis and spacing.',
    });
  }
  return { parts, issues, planePositionsMm: planes.map(rounded) };
}
