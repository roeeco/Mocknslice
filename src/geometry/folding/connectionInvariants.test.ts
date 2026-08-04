import { describe, expect, it } from 'vitest';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { generateFoldTemplate } from './generateFoldTemplate';

describe('fold connection invariants', () => {
  it('gives every open-box closure a single, valid connection', () => {
    const cube = createCubeMesh(40);
    const result = generateFoldTemplate({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'fixture-cube',
      materialThicknessMm: 1,
      settings: {
        templateKind: 'open-box',
        fitAxis: 'z',
        clearanceMm: 0,
        profileToleranceMm: 1,
        parameters: { wallHeightMm: 42, tabDepthMm: 100 },
      },
    });
    const seams = result.connections.filter((connection) => connection.required);
    expect(seams).toHaveLength(4);
    expect(seams.every((connection) => connection.tabIds.length === 1)).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toContain('TAB_DEPTH_CLAMPED');
    expect(result.issues.some((issue) => issue.code.startsWith('FOLD_CONNECTION_'))).toBe(false);
  });
});
