import { describe, expect, it } from 'vitest';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { normalizeMesh } from '../mesh/normalizeMesh';
import { createNonManifoldSoup, createOpenCubeSoup } from '../../test-fixtures/generatedMeshes';
import { buildMeshTopology } from './meshAdjacency';

describe('buildMeshTopology', () => {
  it('builds stable adjacency for an indexed cube', () => {
    const topology = buildMeshTopology(createCubeMesh(40).mesh);

    expect(topology.faces).toHaveLength(12);
    expect(topology.edges).toHaveLength(18);
    expect(topology.boundaryEdgeCount).toBe(0);
    expect(topology.nonManifoldEdgeCount).toBe(0);
    expect(topology.orientationIssueCount).toBe(0);
    expect(topology.edges.map((edge) => edge.key)).toEqual(
      [...topology.edges.map((edge) => edge.key)].sort((first, second) => {
        const [firstA = 0, firstB = 0] = first.split(':').map(Number);
        const [secondA = 0, secondB = 0] = second.split(':').map(Number);
        return firstA === secondA ? firstB - secondB : firstA - secondA;
      }),
    );
  });

  it('reports open and non-manifold topology', () => {
    const open = normalizeMesh(createOpenCubeSoup(), { assumedUnit: 'millimetres' });
    const nonManifold = normalizeMesh(createNonManifoldSoup(), { assumedUnit: 'millimetres' });

    expect(buildMeshTopology(open.mesh).boundaryEdgeCount).toBeGreaterThan(0);
    expect(buildMeshTopology(nonManifold.mesh).nonManifoldEdgeCount).toBeGreaterThan(0);
  });
});
