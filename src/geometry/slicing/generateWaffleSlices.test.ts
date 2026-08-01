import { describe, expect, it } from 'vitest';
import type { SliceAxis } from '../../domain/fabrication';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { normalizeMesh } from '../mesh/normalizeMesh';
import { createHollowPrismSoup } from '../../test-fixtures/generatedMeshes';
import { generateWaffleSlices } from './generateWaffleSlices';

function generate(primaryAxis: SliceAxis, secondaryAxis: SliceAxis) {
  const cube = createCubeMesh(40);
  return generateWaffleSlices({
    mesh: cube.mesh,
    bounds: cube.bounds,
    modelId: 'cube',
    settings: {
      primaryAxis,
      secondaryAxis,
      primarySpacingMm: 20,
      secondarySpacingMm: 20,
      thicknessMm: 1,
      clearanceMm: 0.2,
      contourEpsilonMm: 0.001,
      slotPattern: 'by-family',
      reverseSlots: false,
    },
  });
}

describe('generateWaffleSlices', () => {
  it.each([
    ['x', 'y'],
    ['x', 'z'],
    ['y', 'z'],
  ] as const)('creates complementary slots for %s/%s cube families', (first, second) => {
    const result = generate(first, second);

    expect(result.parts).toHaveLength(4);
    expect(result.slotCount).toBe(4);
    expect(result.parts.every((part) => part.waffle?.slotCount === 2)).toBe(true);
    const slots = result.parts.flatMap((part) => part.paths.filter((path) => path.slot));
    expect(slots).toHaveLength(8);
    expect(slots.every((slot) => slot.slot?.widthMm === 1.2)).toBe(true);
    for (const slot of slots) {
      const paired = slots.find(
        (candidate) =>
          candidate.slot?.pairedPartId ===
            result.parts.find((part) => part.paths.includes(slot))?.id &&
          result.parts.find((part) => part.paths.includes(candidate))?.id ===
            slot.slot?.pairedPartId,
      );
      expect(paired?.slot?.direction).not.toBe(slot.slot?.direction);
    }
  });

  it('reverses and alternates slot directions deterministically', () => {
    const cube = createCubeMesh(40);
    const input = {
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'cube',
      settings: {
        primaryAxis: 'x' as const,
        secondaryAxis: 'y' as const,
        primarySpacingMm: 20,
        secondarySpacingMm: 20,
        thicknessMm: 1,
        clearanceMm: 0,
        contourEpsilonMm: 0.001,
        slotPattern: 'alternating' as const,
        reverseSlots: false,
      },
    };
    const normal = generateWaffleSlices(input);
    const reversed = generateWaffleSlices({
      ...input,
      settings: { ...input.settings, reverseSlots: true },
    });
    const directions = normal.parts.flatMap((part) =>
      part.paths.filter((path) => path.slot).map((path) => path.slot!.direction),
    );
    const reversedDirections = reversed.parts.flatMap((part) =>
      part.paths.filter((path) => path.slot).map((path) => path.slot!.direction),
    );

    expect(directions).toContain('start');
    expect(directions).toContain('end');
    expect(reversedDirections).toEqual(
      directions.map((direction) => (direction === 'start' ? 'end' : 'start')),
    );
  });

  it('reports slots that overlap because spacing is narrower than slot width', () => {
    const cube = createCubeMesh(10);
    const result = generateWaffleSlices({
      mesh: cube.mesh,
      bounds: cube.bounds,
      modelId: 'cube',
      settings: {
        primaryAxis: 'x',
        secondaryAxis: 'y',
        primarySpacingMm: 2,
        secondarySpacingMm: 2,
        thicknessMm: 3,
        clearanceMm: 0,
        contourEpsilonMm: 0.001,
        slotPattern: 'by-family',
        reverseSlots: false,
      },
    });

    expect(result.issues.some((issue) => issue.code === 'OVERLAPPING_WAFFLE_SLOTS')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'WAFFLE_SLOT_OUTSIDE_USABLE_CONTOUR')).toBe(
      true,
    );
  });

  it('rejects parallel slice families', () => {
    const cube = createCubeMesh(40);
    expect(() =>
      generateWaffleSlices({
        mesh: cube.mesh,
        bounds: cube.bounds,
        modelId: 'cube',
        settings: {
          primaryAxis: 'x',
          secondaryAxis: 'x',
          primarySpacingMm: 20,
          secondarySpacingMm: 20,
          thicknessMm: 1,
          clearanceMm: 0,
          contourEpsilonMm: 0.001,
          slotPattern: 'by-family',
          reverseSlots: false,
        },
      }),
    ).toThrow('must be perpendicular');
  });

  it('requires manual review when a slot can enter through an internal hole', () => {
    const prism = normalizeMesh(createHollowPrismSoup(), { assumedUnit: 'millimetres' });
    const result = generateWaffleSlices({
      mesh: prism.mesh,
      bounds: prism.bounds,
      modelId: 'hollow-prism',
      settings: {
        primaryAxis: 'z',
        secondaryAxis: 'x',
        primarySpacingMm: 20,
        secondarySpacingMm: 15,
        thicknessMm: 1,
        clearanceMm: 0.1,
        contourEpsilonMm: 0.001,
        slotPattern: 'by-family',
        reverseSlots: false,
      },
    });

    expect(
      result.issues.some((issue) => issue.code === 'WAFFLE_HOLE_SLOT_ENTRY_REQUIRES_REVIEW'),
    ).toBe(true);
  });
});
