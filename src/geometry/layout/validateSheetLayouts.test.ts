import { describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import type { FabricationPart } from '../../domain/fabrication';
import { validateSheetLayouts } from './validateSheetLayouts';

function part(id: string): FabricationPart {
  return {
    id,
    name: id,
    thicknessMm: 1,
    paths: [
      {
        id: `${id}-cut`,
        operation: 'cut',
        closed: true,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
      },
    ],
  };
}

describe('validateSheetLayouts', () => {
  it('reports overlaps, margin crossings, outside parts, and unplaced parts', () => {
    const project = createProject();
    project.generatedParts = [part('a'), part('b'), part('c'), part('d')];
    project.sheetLayouts = [
      {
        id: 'sheet-a',
        widthMm: 50,
        heightMm: 50,
        marginMm: 5,
        spacingMm: 3,
        placements: [
          { partId: 'a', x: 5, y: 5, rotationDeg: 0 },
          { partId: 'b', x: 10, y: 10, rotationDeg: 0 },
          { partId: 'c', x: 45, y: 45, rotationDeg: 0 },
        ],
      },
    ];

    const codes = validateSheetLayouts(project).map((issue) => issue.code);
    expect(codes).toContain('PARTS_OVERLAP');
    expect(codes).toContain('PART_OUTSIDE_SHEET');
    expect(codes).toContain('PART_UNPLACED');
  });

  it('accepts a valid deterministic arrangement', () => {
    const project = createProject();
    project.generatedParts = [part('a'), part('b')];
    project.sheetLayouts[0]!.placements = [
      { partId: 'a', x: 5, y: 5, rotationDeg: 0 },
      { partId: 'b', x: 20, y: 5, rotationDeg: 0 },
    ];
    expect(validateSheetLayouts(project)).toEqual([]);
  });
});
