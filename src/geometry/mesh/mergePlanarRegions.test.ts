import { describe, expect, it } from 'vitest';
import { fabricationMeshes } from '../../test-fixtures/fabricationMeshes';
import { mergePlanarRegions } from './mergePlanarRegions';

describe('mergePlanarRegions', () => {
  it('merges a triangulated cube into six planar quad panels', () => {
    const prepared = mergePlanarRegions(fabricationMeshes.triangulatedCube);
    expect(prepared.panels).toHaveLength(6);
    expect(prepared.panels.every((panel) => panel.sourceFaceIndices.length === 2)).toBe(true);
    expect(prepared.panels.every((panel) => panel.boundaryLoops[0]?.length === 4)).toBe(true);
    expect(prepared.metrics.sourceTriangleCount).toBe(12);
    expect(prepared.metrics.outputPanelCount).toBe(6);
  });
});
