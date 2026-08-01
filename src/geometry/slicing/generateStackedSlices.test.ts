import { describe, expect, it } from 'vitest';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { normalizeMesh } from '../mesh/normalizeMesh';
import {
  createCylinderSoup,
  createHollowPrismSoup,
  createOpenCubeSoup,
} from '../../test-fixtures/generatedMeshes';
import { generateStackedSlices } from './generateStackedSlices';
import type { SliceAxis } from '../../domain/fabrication';

const settings = (axis: SliceAxis) => ({
  axis,
  spacingMm: 10,
  thicknessMm: 1,
  contourEpsilonMm: 0.001,
});

describe('generateStackedSlices', () => {
  it.each(['x', 'y', 'z'] as const)('creates four closed 40 mm cube slices on %s', (axis) => {
    const cube = createCubeMesh(40);
    const result = generateStackedSlices({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'cube',
      settings: settings(axis),
    });

    expect(result.planePositionsMm).toEqual([-15, -5, 5, 15]);
    expect(result.parts).toHaveLength(4);
    expect(result.parts.every((part) => part.paths[0]?.closed)).toBe(true);
    for (const part of result.parts) {
      const outer = part.paths[0]!;
      expect(
        Math.max(...outer.points.map((point) => point.x)) -
          Math.min(...outer.points.map((point) => point.x)),
      ).toBeCloseTo(40);
      expect(
        Math.max(...outer.points.map((point) => point.y)) -
          Math.min(...outer.points.map((point) => point.y)),
      ).toBeCloseTo(40);
    }
  });

  it('traces deterministic closed cylinder contours', () => {
    const cylinder = normalizeMesh(createCylinderSoup(), { assumedUnit: 'millimetres' });
    const result = generateStackedSlices({
      mesh: cylinder.mesh,
      bounds: cylinder.bounds,
      modelId: 'cylinder',
      settings: { ...settings('z'), spacingMm: 6 },
    });
    expect(result.parts).toHaveLength(5);
    expect(result.parts[0]?.paths[0]?.points).toHaveLength(48);
    expect(result.issues.some((issue) => issue.code === 'OPEN_SLICE_CONTOUR')).toBe(false);
  });

  it('classifies the inner contour of a hollow prism as a hole', () => {
    const prism = normalizeMesh(createHollowPrismSoup(), { assumedUnit: 'millimetres' });
    const result = generateStackedSlices({
      mesh: prism.mesh,
      bounds: prism.bounds,
      modelId: 'hollow-prism',
      settings: { ...settings('z'), spacingMm: 20 },
    });
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0]?.paths.map((path) => path.contourRole)).toEqual(['outer', 'hole']);
  });

  it('reports rather than closes open contours', () => {
    const open = normalizeMesh(createOpenCubeSoup(), { assumedUnit: 'millimetres' });
    const result = generateStackedSlices({
      mesh: open.mesh,
      bounds: open.bounds,
      modelId: 'open-cube',
      settings: settings('z'),
    });
    expect(result.issues.some((issue) => issue.code === 'OPEN_SLICE_CONTOUR')).toBe(true);
  });
});
