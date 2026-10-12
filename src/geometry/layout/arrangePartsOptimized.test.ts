import { describe, expect, it } from 'vitest';
import type { FabricationPart, SheetLayout } from '../../domain/fabrication';
import { arrangePartsOptimized } from './arrangePartsOptimized';
import { arrangePartsInRows } from './arrangeParts';
import { intersectPlacedParts } from './intersectPlacedParts';
const rect = (id: string, w: number, h: number): FabricationPart => ({
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
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ],
    },
  ],
});
const template: SheetLayout = {
  id: 'sheet',
  widthMm: 100,
  heightMm: 80,
  marginMm: 5,
  spacingMm: 3,
  placements: [],
};
describe('deterministic MaxRects arrangement', () => {
  it('packs two rotated parts on one sheet where quick rows need two', () => {
    const parts = [rect('a', 60, 40), rect('b', 60, 40)],
      result = arrangePartsOptimized(parts, template);
    expect(arrangePartsInRows(parts, template)).toHaveLength(2);
    expect(result.layouts.filter((s) => s.placements.length)).toHaveLength(1);
    expect(result.issues).toEqual([]);
    expect(result.layouts[0]!.placements.every((p) => p.rotationDeg === 90)).toBe(true);
    expect(result).toEqual(arrangePartsOptimized([...parts].reverse(), template));
    expect(intersectPlacedParts(parts, result.layouts)).toEqual([]);
  });
  it('respects rotation restrictions and preserves arbitrary locked transforms', () => {
    const large = [rect('wide', 60, 40), rect('second', 60, 40)],
      unrotated = arrangePartsOptimized(large, template, { rotationAllowed: false });
    expect(unrotated.layouts.filter((s) => s.placements.length)).toHaveLength(2);
    expect(unrotated.layouts.flatMap((s) => s.placements).every((p) => p.rotationDeg === 0)).toBe(
      true,
    );
    const locked = {
        ...template,
        placements: [{ partId: 'locked', x: 35, y: 25, rotationDeg: 37 }],
      },
      parts = [rect('locked', 15, 10), rect('free', 20, 20)],
      before = structuredClone(locked),
      result = arrangePartsOptimized(parts, template, {
        existingLayouts: [locked],
        lockedPartIds: ['locked'],
      });
    expect(result.issues).toEqual([]);
    expect(result.layouts[0]!.placements.find((p) => p.partId === 'locked')).toEqual(
      before.placements[0],
    );
    expect(locked).toEqual(before);
  });
  it('reports enlarged locked conflicts and impossible parts instead of moving them', () => {
    const locked = { ...template, placements: [{ partId: 'fixed', x: 90, y: 70, rotationDeg: 0 }] },
      result = arrangePartsOptimized([rect('fixed', 20, 20)], template, {
        existingLayouts: [locked],
        lockedPartIds: ['fixed'],
      });
    expect(result.layouts[0]!.placements).toEqual(locked.placements);
    expect(result.issues.map((i) => i.code)).toContain('PART_OUTSIDE_SHEET');
    const tooLarge = arrangePartsOptimized([rect('big', 200, 200)], template);
    expect(tooLarge.issues.map((i) => i.code)).toContain('PART_TOO_LARGE_FOR_SHEET');
    expect(tooLarge.layouts.flatMap((s) => s.placements)).toEqual([]);
  });
});
