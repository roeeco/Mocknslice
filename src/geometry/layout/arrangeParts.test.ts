import { describe, expect, it } from 'vitest';
import type { FabricationPart, SheetLayout } from '../../domain/fabrication';
import { arrangePartsInRows } from './arrangeParts';
import { transformedBoundsForPart, transformPoint } from './partPlacement';

function squarePart(id: string, size = 40): FabricationPart {
  const half = size / 2;
  return {
    id,
    name: id,
    thicknessMm: 1,
    paths: [
      {
        id: `${id}-cut`,
        operation: 'cut',
        closed: true,
        contourRole: 'outer',
        points: [
          { x: -half, y: -half },
          { x: half, y: -half },
          { x: half, y: half },
          { x: -half, y: half },
        ],
      },
    ],
  };
}

const sheet = (widthMm: number, heightMm: number): SheetLayout => ({
  id: 'sheet-a',
  widthMm,
  heightMm,
  marginMm: 5,
  spacingMm: 3,
  placements: [],
});

describe('arrangePartsInRows', () => {
  it('places ordered parts in deterministic rows inside the margin', () => {
    const parts = ['a', 'b', 'c', 'd'].map((id) => squarePart(id));
    const first = arrangePartsInRows(parts, sheet(100, 100));
    const second = arrangePartsInRows(parts, sheet(100, 100));

    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(first[0]?.placements).toEqual([
      { partId: 'a', x: 25, y: 25, rotationDeg: 0 },
      { partId: 'b', x: 68, y: 25, rotationDeg: 0 },
      { partId: 'c', x: 25, y: 68, rotationDeg: 0 },
      { partId: 'd', x: 68, y: 68, rotationDeg: 0 },
    ]);
  });

  it('adds stable sheets when rows no longer fit', () => {
    const result = arrangePartsInRows(
      ['a', 'b', 'c', 'd'].map((id) => squarePart(id)),
      sheet(60, 60),
    );

    expect(result.map((candidate) => candidate.id)).toEqual([
      'sheet-a',
      'sheet-a-2',
      'sheet-a-3',
      'sheet-a-4',
    ]);
    expect(result.every((candidate) => candidate.placements.length === 1)).toBe(true);
  });
});

describe('part placement transforms', () => {
  it('rotates around the part origin before translating', () => {
    const point = transformPoint({ x: 2, y: 1 }, { partId: 'a', x: 10, y: 20, rotationDeg: 90 });
    expect(point.x).toBeCloseTo(9);
    expect(point.y).toBeCloseTo(22);
    const bounds = transformedBoundsForPart(squarePart('a', 10), {
      partId: 'a',
      x: 15,
      y: 20,
      rotationDeg: 90,
    });
    expect(bounds?.minX).toBeCloseTo(10);
    expect(bounds?.minY).toBeCloseTo(15);
    expect(bounds?.maxX).toBeCloseTo(20);
    expect(bounds?.maxY).toBeCloseTo(25);
  });
});
