import { describe, expect, it } from 'vitest';
import { fabricationMeshes } from '../../test-fixtures/fabricationMeshes';
import { developSurfacePatch } from './developSurfacePatch';

describe('analytic surface development', () => {
  it.each([
    ['cylindrical', fabricationMeshes.cylindricalPatch],
    ['conical', fabricationMeshes.conicalPatch],
  ] as const)('develops a bounded %s patch with a stable source mapping', (kind, mesh) => {
    const result = developSurfacePatch(mesh, { maximumEdgeStrainPercent: 0.5 });
    expect(result.kind).toBe(kind);
    expect(result.vertices.map((vertex) => vertex.sourceVertexIndex)).toEqual(
      Array.from({ length: mesh.positionsMm.length / 3 }, (_, index) => index),
    );
    expect(result.metrics.maximumEdgeStrainPercent).toBeLessThan(0.5);
    expect(result.metrics.flippedTriangleCount).toBe(0);
    expect(result.withinTolerance).toBe(true);
  });

  it('refuses to call a compound-curved patch an exact unfold', () => {
    expect(() =>
      developSurfacePatch(fabricationMeshes.sphericalPatch, { maximumEdgeStrainPercent: 1 }),
    ).toThrow(/no exact analytic development/);
  });
});
