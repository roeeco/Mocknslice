import { describe, expect, it } from 'vitest';
import { DEFAULT_MATERIALS, getDefaultMaterial } from './defaultMaterials';

describe('default materials', () => {
  it('provides the five foundation profiles in explicit millimetres', () => {
    expect(DEFAULT_MATERIALS.map((material) => material.id)).toEqual([
      'paper-160gsm',
      'card-300gsm',
      'chipboard-1mm',
      'corrugated-3mm',
      'plywood-3mm',
    ]);
    expect(DEFAULT_MATERIALS.every((material) => material.thicknessMm >= 0)).toBe(true);
    expect(DEFAULT_MATERIALS.every((material) => material.defaultSheetWidthMm > 0)).toBe(true);
  });

  it('returns a clone so project snapshots cannot mutate the library', () => {
    const first = getDefaultMaterial('card-300gsm');
    const second = getDefaultMaterial('card-300gsm');

    first.name = 'Edited snapshot';

    expect(second.name).toBe('300 gsm card');
  });
});
