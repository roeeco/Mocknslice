import { describe, expect, it } from 'vitest';
import { fabricationMeshes } from '../../test-fixtures/fabricationMeshes';
import { simplifyMeshQem } from './simplifyMeshQem';

describe('simplifyMeshQem', () => {
  it('is deterministic and preserves sharp cube features', () => {
    const settings = { targetFaceCount: 6, maximumDeviationMm: 1, sharpEdgeAngleDeg: 30 };
    const first = simplifyMeshQem(fabricationMeshes.triangulatedCube, settings);
    expect(first).toEqual(simplifyMeshQem(fabricationMeshes.triangulatedCube, settings));
    expect(first.afterFaceCount).toBe(12);
    expect(first.preservedSharpFeatureCount).toBe(12);
    expect(first.maximumDeviationMm).toBe(0);
  });

  it('reduces a closed smooth fixture without exceeding its deviation limit', () => {
    const result = simplifyMeshQem(fabricationMeshes.cylinder, {
      targetFaceCount: 80,
      maximumDeviationMm: 20,
      sharpEdgeAngleDeg: 181,
    });
    expect(result.afterFaceCount).toBeLessThan(result.beforeFaceCount);
    expect(result.afterFaceCount).toBeGreaterThanOrEqual(80);
    expect(result.maximumDeviationMm).toBeLessThanOrEqual(20);
  });
});
