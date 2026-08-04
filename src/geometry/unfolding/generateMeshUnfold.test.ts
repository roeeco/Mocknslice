import { describe, expect, it } from 'vitest';
import type { MeshUnfoldSettings } from '../../domain/unfolding';
import { createAsymmetricTetraSoup, createOpenCubeSoup } from '../../test-fixtures/generatedMeshes';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { normalizeMesh } from '../mesh/normalizeMesh';
import { buildMeshTopology } from './meshAdjacency';
import { deterministicUnfoldHash, generateMeshUnfold } from './generateMeshUnfold';

const automaticSettings: MeshUnfoldSettings = {
  strategy: 'automatic',
  rootFaceIndex: 0,
  manualSeamKeys: [],
  tabDepthMm: 6,
  maximumFaceCount: 200,
  searchAttempts: 18,
};

function edgeLength(points: readonly [number, number, number][], first: number, second: number) {
  return Math.hypot(
    points[first]![0] - points[second]![0],
    points[first]![1] - points[second]![1],
    points[first]![2] - points[second]![2],
  );
}

describe('generateMeshUnfold', () => {
  it('creates a deterministic one-island cube net with paired seams and tabs', () => {
    const mesh = createCubeMesh(40).mesh;
    const input = {
      mesh,
      modelId: 'cube',
      materialThicknessMm: 1,
      settings: automaticSettings,
    };
    const first = generateMeshUnfold(input);
    const second = generateMeshUnfold(input);

    expect(first).toEqual(second);
    expect(first.faces).toHaveLength(12);
    expect(first.islands).toHaveLength(1);
    expect(first.hinges).toHaveLength(11);
    expect(first.edges.filter((edge) => edge.disposition === 'hinge')).toHaveLength(11);
    expect(first.edges.filter((edge) => edge.disposition === 'seam')).toHaveLength(7);
    expect(first.tabs).toHaveLength(7);
    expect(first.connections.filter((connection) => connection.required)).toHaveLength(7);
    expect(
      first.connections
        .filter((connection) => connection.required)
        .every((connection) => connection.tabIds.length === 1),
    ).toBe(true);
    expect(first.parts).toHaveLength(1);
    expect(first.overlapPairs).toHaveLength(0);
    expect(first.inputHash).toMatch(/^sf8-[0-9a-f]{8}$/);
    expect(first.algorithmVersion).toBe('triangle-tree-v1');
    expect(first.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(
      first.edges.filter((edge) => edge.disposition === 'seam').map((edge) => edge.pairLabel),
    ).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']);

    for (const face of first.faces) {
      for (const [a, b] of [
        [0, 1],
        [1, 2],
        [2, 0],
      ] as const) {
        expect(edgeLength(face.flatVerticesMm, a, b)).toBeCloseTo(
          edgeLength(face.sourceVerticesMm, a, b),
          5,
        );
      }
    }
  });

  it('honours manual seams and creates separate labelled islands', () => {
    const normalized = normalizeMesh(createAsymmetricTetraSoup(), {
      assumedUnit: 'millimetres',
    });
    const allSharedEdges = buildMeshTopology(normalized.mesh).edges.map((edge) => edge.key);
    const result = generateMeshUnfold({
      mesh: normalized.mesh,
      modelId: 'tetra',
      materialThicknessMm: 0.8,
      settings: { ...automaticSettings, strategy: 'manual', manualSeamKeys: allSharedEdges },
    });

    expect(result.faces).toHaveLength(4);
    expect(result.islands).toHaveLength(4);
    expect(result.hinges).toHaveLength(0);
    expect(result.tabs).toHaveLength(6);
    expect(result.overlapPairs).toHaveLength(0);
    expect(result.issues.map((issue) => issue.code)).toContain('UNFOLD_MULTIPLE_ISLANDS');
  });

  it('rejects open meshes and explicit face-limit violations', () => {
    const open = normalizeMesh(createOpenCubeSoup(), { assumedUnit: 'millimetres' });
    const openResult = generateMeshUnfold({
      mesh: open.mesh,
      modelId: 'open-cube',
      materialThicknessMm: 1,
      settings: automaticSettings,
    });
    const limitedResult = generateMeshUnfold({
      mesh: createCubeMesh(40).mesh,
      modelId: 'cube',
      materialThicknessMm: 1,
      settings: { ...automaticSettings, maximumFaceCount: 6 },
    });

    expect(openResult.issues.map((issue) => issue.code)).toContain(
      'UNFOLD_REQUIRES_CLOSED_MANIFOLD',
    );
    expect(limitedResult.issues.map((issue) => issue.code)).toContain('UNFOLD_FACE_LIMIT');
    expect(openResult.parts).toHaveLength(0);
    expect(limitedResult.parts).toHaveLength(0);
  });

  it('reports glue-tab collisions instead of trimming them silently', () => {
    const cube = createCubeMesh(40);
    const result = generateMeshUnfold({
      mesh: cube.mesh,
      modelId: 'cube',
      materialThicknessMm: 1,
      settings: { ...automaticSettings, tabDepthMm: 100 },
    });

    expect(result.issues.map((issue) => issue.code)).toContain('UNFOLD_TAB_OVERLAP');
    expect(result.tabs.every((tab) => tab.depthMm === 100)).toBe(true);
  });

  it('hashes sorted seam settings deterministically', () => {
    const base = {
      mesh: createCubeMesh(10).mesh,
      modelId: 'cube',
      materialThicknessMm: 1,
      settings: { ...automaticSettings, manualSeamKeys: ['1:2', '0:1'] },
    };

    expect(deterministicUnfoldHash(base)).toBe(
      deterministicUnfoldHash({
        ...base,
        settings: { ...base.settings, manualSeamKeys: ['0:1', '1:2'] },
      }),
    );
    expect(deterministicUnfoldHash(base)).not.toBe(
      deterministicUnfoldHash({
        ...base,
        settings: { ...base.settings, tabDepthMm: 7 },
      }),
    );
  });
});
