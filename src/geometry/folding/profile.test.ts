import { describe, expect, it } from 'vitest';
import type { SliceAxis } from '../../domain/fabrication';
import type { TemplateFitSettings } from '../../domain/folding';
import {
  createAsymmetricTetraSoup,
  createConeSoup,
  createCubeSoup,
  createCylinderSoup,
  createTaperedPrismSoup,
} from '../../test-fixtures/generatedMeshes';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { normalizeMesh } from '../mesh/normalizeMesh';
import { deterministicFoldingHash, extractProjectedProfile } from './profile';

function settings(fitAxis: SliceAxis, clearanceMm = 1): TemplateFitSettings {
  return {
    templateKind: 'sleeve',
    fitAxis,
    clearanceMm,
    profileToleranceMm: 1,
    parameters: {},
  };
}

describe('extractProjectedProfile', () => {
  it.each(['x', 'y', 'z'] as const)('encloses a cube with clearance on %s', (fitAxis) => {
    const cube = createCubeMesh(40);
    const result = extractProjectedProfile({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'cube',
      settings: settings(fitAxis),
      materialThicknessMm: 1,
    });

    expect(result.profile?.fittedPoints).toHaveLength(4);
    expect(Math.min(...result.profile!.fittedPoints.map((point) => point.x))).toBeCloseTo(-21);
    expect(Math.max(...result.profile!.fittedPoints.map((point) => point.x))).toBeCloseTo(21);
    expect(Math.min(...result.profile!.fittedPoints.map((point) => point.y))).toBeCloseTo(-21);
    expect(Math.max(...result.profile!.fittedPoints.map((point) => point.y))).toBeCloseTo(21);
    expect(result.profile?.depthMm).toBe(42);
  });

  it.each([
    ['cube', createCubeSoup(40)],
    ['cylinder', createCylinderSoup(12, 30, 24)],
    ['cone', createConeSoup()],
    ['asymmetric', createAsymmetricTetraSoup()],
    ['tapered', createTaperedPrismSoup()],
  ] as const)('encloses every %s projection with clearance on all axes', (_name, soup) => {
    const model = normalizeMesh(soup, { assumedUnit: 'millimetres' });
    for (const fitAxis of axes) {
      const clearance = 1.25;
      const result = extractProjectedProfile({
        mesh: model.mesh,
        bounds: model.bounds,
        modelId: _name,
        settings: { ...settings(fitAxis, clearance), profileToleranceMm: 0 },
        materialThicknessMm: 0.35,
      });
      expect(result.profile, `${_name} on ${fitAxis}`).toBeDefined();
      const fitted = result.profile!.fittedPoints;
      for (const point of result.profile!.sourceHullPoints) {
        for (let index = 0; index < fitted.length; index += 1) {
          const start = fitted[index]!;
          const end = fitted[(index + 1) % fitted.length]!;
          const edgeX = end.x - start.x;
          const edgeY = end.y - start.y;
          const inwardDistance =
            (edgeX * (point.y - start.y) - edgeY * (point.x - start.x)) / Math.hypot(edgeX, edgeY);
          expect(inwardDistance, `${_name} ${fitAxis} edge ${index}`).toBeGreaterThanOrEqual(
            clearance - 0.000001,
          );
        }
      }
    }
  });

  it('simplifies a detailed cylinder to a visible convex enclosure', () => {
    const cylinder = normalizeMesh(createCylinderSoup(20, 40, 48), {
      assumedUnit: 'millimetres',
    });
    const result = extractProjectedProfile({
      mesh: cylinder.mesh,
      bounds: cylinder.bounds,
      modelId: 'cylinder',
      settings: { ...settings('z', 0.5), profileToleranceMm: 2 },
      materialThicknessMm: 1,
    });

    expect(result.profile?.sourceHullPoints).toHaveLength(48);
    expect(result.profile!.fittedPoints.length).toBeLessThan(48);
    expect(result.issues.map((issue) => issue.code)).toContain('PROFILE_SIMPLIFIED');
  });

  it('rejects a zero-area projection', () => {
    const result = extractProjectedProfile({
      mesh: { positionsMm: [0, 0, 0, 0, 10, 0, 0, 20, 0], indices: [0, 1, 2] },
      bounds: { minMm: [0, 0, 0], maxMm: [0, 20, 0] },
      modelId: 'line',
      settings: settings('x'),
      materialThicknessMm: 1,
    });
    expect(result.profile).toBeUndefined();
    expect(result.issues[0]?.code).toBe('PROFILE_ZERO_AREA');
  });
});

const axes: readonly SliceAxis[] = ['x', 'y', 'z'];

describe('deterministicFoldingHash', () => {
  it('is stable and changes with fit settings', () => {
    const cube = createCubeMesh(40);
    const first = deterministicFoldingHash({
      mesh: cube.mesh,
      settings: settings('z', 1),
      materialThicknessMm: 1,
    });
    expect(first).toBe(
      deterministicFoldingHash({
        mesh: cube.mesh,
        settings: settings('z', 1),
        materialThicknessMm: 1,
      }),
    );
    expect(first).not.toBe(
      deterministicFoldingHash({
        mesh: cube.mesh,
        settings: settings('z', 2),
        materialThicknessMm: 1,
      }),
    );
  });
});
