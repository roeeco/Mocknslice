import { describe, expect, it } from 'vitest';
import type { ModelData } from '../../domain/model';
import { normalizeMesh } from './normalizeMesh';
import { rotateModelMesh90, scaleModelMeshToDimension } from './transformMesh';

function rectangularModel(): ModelData {
  const result = normalizeMesh(
    {
      positions: [0, 0, 0, 10, 0, 0, 0, 20, 0, 0, 0, 0, 0, 0, 30, 10, 0, 0],
    },
    { assumedUnit: 'millimetres' },
  );
  return {
    id: 'model-test',
    name: 'Rectangular fixture',
    source: { kind: 'imported', fileName: 'fixture.stl', format: 'stl' },
    transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] },
    ...result,
  };
}

describe('mesh transforms', () => {
  it('rotates positions and swaps affected dimensions', () => {
    const rotated = rotateModelMesh90(rectangularModel(), 'x');
    expect(rotated.dimensions.widthMm).toBeCloseTo(10);
    expect(rotated.dimensions.heightMm).toBeCloseTo(30);
    expect(rotated.dimensions.depthMm).toBeCloseTo(20);
  });

  it('corrects one dimension with a uniform scale', () => {
    const scaled = scaleModelMeshToDimension(rectangularModel(), 'x', 20);
    expect(scaled.dimensions).toEqual({ widthMm: 20, heightMm: 40, depthMm: 60 });
    expect(scaled.importSettings?.dimensionScale).toBe(2);
  });
});
