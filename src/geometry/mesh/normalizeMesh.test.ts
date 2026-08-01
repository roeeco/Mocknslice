import { describe, expect, it } from 'vitest';
import {
  createCubeSoup,
  createDisconnectedCubesSoup,
  createNonManifoldSoup,
  createOpenCubeSoup,
} from '../../test-fixtures/generatedMeshes';
import { normalizeMesh } from './normalizeMesh';

describe('normalizeMesh', () => {
  it('welds and centres a deterministic closed cube', () => {
    const result = normalizeMesh(createCubeSoup(40), { assumedUnit: 'millimetres' });

    expect(result.mesh.positionsMm).toHaveLength(8 * 3);
    expect(result.mesh.indices).toHaveLength(12 * 3);
    expect(result.dimensions).toEqual({ widthMm: 40, heightMm: 40, depthMm: 40 });
    expect(result.bounds).toEqual({ minMm: [-20, -20, -20], maxMm: [20, 20, 20] });
    expect(result.healthReport).toMatchObject({
      triangleCount: 12,
      openEdgeCount: 0,
      nonManifoldEdgeCount: 0,
      disconnectedShellCount: 1,
      orientationIssueCount: 0,
      weldedVertexCount: 8,
      likelyInverted: false,
    });
    expect(result.healthReport.signedVolumeMm3).toBeCloseTo(64_000);
  });

  it('applies an explicit STL unit conversion before normalization', () => {
    const result = normalizeMesh(createCubeSoup(1), { assumedUnit: 'inches' });
    expect(result.dimensions.widthMm).toBeCloseTo(25.4);
    expect(result.importSettings.sourceUnitToMm).toBe(25.4);
  });

  it('reports zero-area triangles that it removes', () => {
    const cube = createCubeSoup(20);
    cube.positions.push(0, 0, 0, 0, 0, 0, 2, 2, 2);
    const result = normalizeMesh(cube, { assumedUnit: 'millimetres' });
    expect(result.healthReport.triangleCount).toBe(12);
    expect(result.importSettings.removedZeroAreaTriangleCount).toBe(1);
  });

  it('detects open edges, disconnected shells, and non-manifold edges', () => {
    const open = normalizeMesh(createOpenCubeSoup(), { assumedUnit: 'millimetres' });
    const disconnected = normalizeMesh(createDisconnectedCubesSoup(), {
      assumedUnit: 'millimetres',
    });
    const nonManifold = normalizeMesh(createNonManifoldSoup(), { assumedUnit: 'millimetres' });

    expect(open.healthReport.openEdgeCount).toBe(4);
    expect(disconnected.healthReport.disconnectedShellCount).toBe(2);
    expect(nonManifold.healthReport.nonManifoldEdgeCount).toBe(1);
  });

  it('rejects a file with no usable triangles', () => {
    expect(() =>
      normalizeMesh({ positions: [0, 0, 0, 0, 0, 0, 0, 0, 0] }, { assumedUnit: 'millimetres' }),
    ).toThrow('STL does not contain any usable triangles.');
  });
});
