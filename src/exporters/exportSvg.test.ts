import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import golden from '../test-fixtures/golden/stacked-slices.svg?raw';
import sheetGolden from '../test-fixtures/golden/sheet-layout.svg?raw';
import { createSheetSvgDocument, createSvgDocument } from './exportSvg';
import { generateFoldTemplate } from '../geometry/folding/generateFoldTemplate';
import { arrangePartsInRows } from '../geometry/layout/arrangeParts';

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
          {
            id: 'part-a-slot-part-b-1',
            operation: 'cut',
            closed: false,
            points: [
              { x: -1, y: -5 },
              { x: -1, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: -5 },
            ],
            slot: {
              pairedPartId: 'part-b',
              intersectionAxis: 'y',
              centreMm: 0,
              widthMm: 2,
              depthMm: 5,
              direction: 'start',
            },
          },
        ],
        waffle: { family: 'a', slotCount: 1 },
      },
    ];
    expect(createSheetSvgDocument(project, 'sheet-golden')).toBe(sheetGolden);
  });

  it('preserves folding operation layers, labels, and entity metadata', () => {
    const project = createProject('Fold layers');
    if (!project.model.mesh || !project.model.bounds)
      throw new Error('Fixture model is incomplete.');
    const result = generateFoldTemplate({
      mesh: project.model.mesh,
      bounds: project.model.bounds,
      modelId: project.model.id,
      materialThicknessMm: project.materialProfileSnapshot.thicknessMm,
      settings: {
        templateKind: 'open-box',
        fitAxis: 'z',
        clearanceMm: 1,
        profileToleranceMm: 0.5,
        parameters: { wallHeightMm: 20, tabDepthMm: 8 },
      },
    });
    project.fabricationMode = 'fold-template';
    project.generatedParts = result.parts;
    project.foldingResult = result;
    project.sheetLayouts = arrangePartsInRows(result.parts, project.sheetLayouts[0]!);

    const svg = createSheetSvgDocument(project, project.sheetLayouts[0]!.id);
    expect(svg).toContain('id="operation-cut"');
    expect(svg).toContain('id="operation-score"');
    expect(svg).toContain('id="operation-valley-fold"');
    expect(svg).toContain('data-panel-id=');
    expect(svg).toContain('data-edge-id=');
    expect(svg).toContain('data-tab-id=');
    expect(svg).toContain('data-entity-id=');
  });
});
