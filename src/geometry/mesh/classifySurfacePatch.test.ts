import { describe, expect, it } from 'vitest';
import type { Point2D } from '../../domain/geometry';
import { fabricationMeshes } from '../../test-fixtures/fabricationMeshes';
import { classifySurfacePatch } from './classifySurfacePatch';
import { measureFlattening } from './measureFlattening';

describe('surface patch classification', () => {
  it('distinguishes developable revolved patches', () => {
    expect(classifySurfacePatch(fabricationMeshes.cylindricalPatch)).toMatchObject({
      kind: 'cylindrical',
      flatteningStrategy: 'analytic',
      estimatedAxis: [0, 0, 1],
    });
    expect(classifySurfacePatch(fabricationMeshes.conicalPatch)).toMatchObject({
      kind: 'conical',
      flatteningStrategy: 'analytic',
      estimatedAxis: [0, 0, 1],
    });
  });

  it('rejects positive and negative compound curvature', () => {
    for (const mesh of [fabricationMeshes.sphericalPatch, fabricationMeshes.saddlePatch]) {
      const result = classifySurfacePatch(mesh);
      expect(result.kind).toBe('compound-curved');
      expect(result.flatteningStrategy).toBe('unsupported');
      expect(result.maximumGaussianCurvature).toBeGreaterThan(0.005);
    }
  });

  it('measures bounded error for a cylindrical chord-based development', () => {
    const mesh = fabricationMeshes.cylindricalPatch;
    const columns = 13;
    const radius = 20;
    const flattened: Point2D[] = Array.from({ length: mesh.positionsMm.length / 3 }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      return { x: (column / 12) * Math.PI * radius, y: (row / 4) * 60 };
    });
    const metrics = measureFlattening(mesh, flattened);
    expect(metrics.maximumEdgeStrainPercent).toBeLessThan(0.4);
    expect(metrics.rmsEdgeStrainPercent).toBeLessThan(0.3);
    expect(metrics.areaDistortionPercent).toBeLessThan(0.4);
    expect(metrics.maximumAngleDistortionDeg).toBeLessThan(0.2);
    expect(metrics.flippedTriangleCount).toBe(0);
  });
});
