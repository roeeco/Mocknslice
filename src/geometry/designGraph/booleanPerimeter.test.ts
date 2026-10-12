import { describe, expect, it } from 'vitest';
import { booleanPerimeter } from './booleanPerimeter';
import { signedArea, isSimplePolygon } from './polygons';
const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
describe('original boolean material perimeter', () => {
  it('joins overlapping additions and removes intersecting corner cuts without duplicated borders', () => {
    const union = booleanPerimeter([rect(0, 0, 20, 20), rect(20, 5, 5, 10)])!;
    expect(union).toHaveLength(1);
    expect(isSimplePolygon(union[0]!)).toBe(true);
    expect(signedArea(union[0]!)).toBeCloseTo(450, 7);
    const cut = booleanPerimeter([rect(0, 0, 20, 20)], [rect(-2, 0, 5, 10), rect(0, -2, 10, 5)])!;
    expect(cut).toHaveLength(1);
    expect(isSimplePolygon(cut[0]!)).toBe(true);
    expect(signedArea(cut[0]!)).toBeCloseTo(349, 7);
  });
  it('preserves holes and rejects ambiguous point-only contacts', () => {
    const loops = booleanPerimeter([rect(0, 0, 30, 30)], [rect(10, 10, 10, 10)])!;
    expect(loops).toHaveLength(2);
    expect(loops.reduce((sum, p) => sum + signedArea(p), 0)).toBeCloseTo(800, 7);
    expect(signedArea(loops[1]!)).toBeLessThan(0);
    expect(booleanPerimeter([rect(0, 0, 10, 10), rect(10, 10, 10, 10)])).toBeUndefined();
  });
});
