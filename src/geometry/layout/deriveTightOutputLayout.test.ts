import { describe, expect, it } from 'vitest';
import type { FabricationPart } from '../../domain/fabrication';
import { transformedBoundsForPart } from './partPlacement';
import {
  deriveTightOutputLayout,
  TIGHT_OUTPUT_MARGIN_MM,
  TIGHT_OUTPUT_SPACING_MM,
} from './deriveTightOutputLayout';

function rectangle(id: string, width: number, height: number): FabricationPart {
  return {
    id,
    name: id,
    thicknessMm: 3,
    paths: [
      {
        id: `${id}-outline`,
        operation: 'cut',
        closed: true,
        points: [
          { x: -2, y: -3 },
          { x: width - 2, y: -3 },
          { x: width - 2, y: height - 3 },
          { x: -2, y: height - 3 },
        ],
      },
    ],
  };
}

describe('deriveTightOutputLayout', () => {
  it('is deterministic, uses only quarter-turn rotations, and wraps content exactly', () => {
    const parts = [rectangle('wide', 36, 9), rectangle('tall', 8, 28), rectangle('box', 17, 13)];
    const first = deriveTightOutputLayout(parts);
    const second = deriveTightOutputLayout([...parts].reverse());

    expect(second).toEqual(first);
    expect(first.marginMm).toBe(5);
    expect(first.spacingMm).toBe(3);
    expect(first.placements).toHaveLength(parts.length);
    expect(
      first.placements.every(({ rotationDeg }) => rotationDeg === 0 || rotationDeg === 90),
    ).toBe(true);

    const byId = new Map(parts.map((part) => [part.id, part]));
    const bounds = first.placements.map((placement) =>
      transformedBoundsForPart(byId.get(placement.partId)!, placement)!,
    );
    expect(Math.min(...bounds.map((item) => item.minX))).toBeCloseTo(TIGHT_OUTPUT_MARGIN_MM);
    expect(Math.min(...bounds.map((item) => item.minY))).toBeCloseTo(TIGHT_OUTPUT_MARGIN_MM);
    expect(Math.max(...bounds.map((item) => item.maxX))).toBeCloseTo(
      first.widthMm - TIGHT_OUTPUT_MARGIN_MM,
    );
    expect(Math.max(...bounds.map((item) => item.maxY))).toBeCloseTo(
      first.heightMm - TIGHT_OUTPUT_MARGIN_MM,
    );

    for (let left = 0; left < bounds.length; left += 1) {
      for (let right = left + 1; right < bounds.length; right += 1) {
        const a = bounds[left]!;
        const b = bounds[right]!;
        const horizontalGap = Math.max(b.minX - a.maxX, a.minX - b.maxX);
        const verticalGap = Math.max(b.minY - a.maxY, a.minY - b.maxY);
        expect(Math.max(horizontalGap, verticalGap)).toBeGreaterThanOrEqual(
          TIGHT_OUTPUT_SPACING_MM - 1e-7,
        );
      }
    }
  });

  it('does not mutate parts or any persisted layout data', () => {
    const parts = [rectangle('part', 20, 10)];
    const savedLayout = {
      id: 'manual',
      widthMm: 600,
      heightMm: 400,
      marginMm: 12,
      spacingMm: 7,
      placements: [{ partId: 'part', x: 123, y: 45, rotationDeg: 17 }],
    };
    const beforeParts = structuredClone(parts);
    const beforeLayout = structuredClone(savedLayout);

    deriveTightOutputLayout(parts);

    expect(parts).toEqual(beforeParts);
    expect(savedLayout).toEqual(beforeLayout);
  });
});
