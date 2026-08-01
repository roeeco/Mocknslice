import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import golden from '../test-fixtures/golden/stacked-slices.svg?raw';
import sheetGolden from '../test-fixtures/golden/sheet-layout.svg?raw';
import { createSheetSvgDocument, createSvgDocument } from './exportSvg';

describe('createSvgDocument', () => {
  it('matches the deterministic millimetre SVG golden file', () => {
    const project = createProject('Golden');
    project.metadata.id = 'project-golden';
    project.generatedParts = [
      {
        id: 'slice-z-1-1',
        name: 'Slice Z1',
        label: 'Z1',
        thicknessMm: 1,
        slice: { axis: 'z', positionMm: 0, planeIndex: 0 },
        paths: [
          {
            id: 'slice-z-1-1-outer',
            operation: 'cut',
            closed: true,
            contourRole: 'outer',
            points: [
              { x: -5, y: -5 },
              { x: 5, y: -5 },
              { x: 5, y: 5 },
              { x: -5, y: 5 },
            ],
          },
          {
            id: 'slice-z-1-1-hole-1',
            operation: 'cut',
            closed: true,
            contourRole: 'hole',
            points: [
              { x: -2, y: -2 },
              { x: -2, y: 2 },
              { x: 2, y: 2 },
              { x: 2, y: -2 },
            ],
          },
        ],
      },
    ];
    expect(createSvgDocument(project)).toBe(golden);
  });

  it('exports one real sheet with persisted rotation and translation', () => {
    const project = createProject('Golden');
    project.metadata.id = 'project-golden';
    project.sheetLayouts = [
      {
        id: 'sheet-golden',
        widthMm: 50,
        heightMm: 40,
        marginMm: 5,
        spacingMm: 3,
        placements: [{ partId: 'part-a', x: 15, y: 15, rotationDeg: 90 }],
      },
    ];
    project.generatedParts = [
      {
        id: 'part-a',
        name: 'Part A',
        label: 'A',
        thicknessMm: 1,
        paths: [
          {
            id: 'part-a-cut',
            operation: 'cut',
            closed: true,
            contourRole: 'outer',
            points: [
              { x: -5, y: -5 },
              { x: 5, y: -5 },
              { x: 5, y: 5 },
              { x: -5, y: 5 },
            ],
          },
        ],
      },
    ];
    expect(createSheetSvgDocument(project, 'sheet-golden')).toBe(sheetGolden);
  });
});
