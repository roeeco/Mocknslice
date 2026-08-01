import { describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import type { FabricationPart } from '../../domain/fabrication';
import {
  calculateMaterialUsage,
  createRegistrationMarkPaths,
  offsetClosedPathForKerf,
  prepareFabricationOutput,
} from './prepareFabricationOutput';

function square(size: number, clockwise = false) {
  const half = size / 2;
  const points = [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ];
  return clockwise ? [...points].reverse() : points;
}

function contourPart(): FabricationPart {
  return {
    id: 'contour',
    name: 'Contour',
    thicknessMm: 1,
    paths: [
      {
        id: 'outer',
        operation: 'cut',
        closed: true,
        contourRole: 'outer',
        points: square(10),
      },
      {
        id: 'hole',
        operation: 'cut',
        closed: true,
        contourRole: 'hole',
        points: square(4, true),
      },
      {
        id: 'fold',
        operation: 'valley-fold',
        closed: false,
        points: [
          { x: -5, y: 0 },
          { x: 5, y: 0 },
        ],
      },
      {
        id: 'slot',
        operation: 'cut',
        closed: false,
        points: [
          { x: 0, y: -5 },
          { x: 0, y: -2 },
        ],
      },
    ],
  };
}

describe('fabrication output preparation', () => {
  it('offsets outer contours outward and holes inward by half the kerf', () => {
    const project = createProject();
    project.generatedParts = [contourPart()];
    project.exportSettings.kerfCompensation = 'custom';
    project.exportSettings.customKerfMm = 0.2;
    const original = structuredClone(project.generatedParts);

    const result = prepareFabricationOutput(project);
    const outer = result.parts[0]!.paths.find((path) => path.id === 'outer')!;
    const hole = result.parts[0]!.paths.find((path) => path.id === 'hole')!;

    expect(outer.points).toEqual(square(10.2));
    expect(hole.points).toEqual(square(3.8, true));
    expect(project.generatedParts).toEqual(original);
    expect(result.appliedKerfMm).toBe(0.2);
    expect(result.issues.map((issue) => issue.code)).toContain('KERF_OPEN_PATH_SKIPPED');
  });

  it('returns no offset for collapsed or degenerate closed paths', () => {
    expect(
      offsetClosedPathForKerf(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        0.1,
      ),
    ).toBeUndefined();
  });

  it('converts folds to deterministic perforation dashes', () => {
    const project = createProject();
    project.generatedParts = [contourPart()];
    project.exportSettings.foldLineOutput = 'perforate';
    project.exportSettings.perforationDashMm = 2;
    project.exportSettings.perforationGapMm = 1;

    const result = prepareFabricationOutput(project);
    const perforations = result.parts[0]!.paths.filter((path) => path.operation === 'perforate');
    expect(perforations).toHaveLength(4);
    expect(perforations.map((path) => path.points)).toEqual([
      [
        { x: -5, y: 0 },
        { x: -3, y: 0 },
      ],
      [
        { x: -2, y: 0 },
        { x: 0, y: 0 },
      ],
      [
        { x: 1, y: 0 },
        { x: 3, y: 0 },
      ],
      [
        { x: 4, y: 0 },
        { x: 5, y: 0 },
      ],
    ]);
  });

  it('converts fold operations to score lines when requested', () => {
    const project = createProject();
    project.generatedParts = [contourPart()];
    project.exportSettings.foldLineOutput = 'score';
    const result = prepareFabricationOutput(project);
    expect(result.parts[0]!.paths.find((path) => path.id === 'fold')?.operation).toBe('score');
  });

  it('reports an invalid perforation pattern instead of generating broken paths', () => {
    const project = createProject();
    project.generatedParts = [contourPart()];
    project.exportSettings.foldLineOutput = 'perforate';
    project.exportSettings.perforationDashMm = 0;
    expect(prepareFabricationOutput(project).issues.map((issue) => issue.code)).toContain(
      'PERFORATION_PATTERN_INVALID',
    );
  });

  it('reports invalid kerf, label, and stroke settings instead of clamping silently', () => {
    const project = createProject();
    project.exportSettings.kerfCompensation = 'custom';
    project.exportSettings.customKerfMm = -1;
    project.exportSettings.labelFontSizeMm = 0;
    project.exportSettings.operationStyles[0]!.strokeWidthMm = 0;
    expect(prepareFabricationOutput(project).issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'KERF_VALUE_INVALID',
        'LABEL_SIZE_INVALID',
        'OPERATION_STYLE_INVALID',
      ]),
    );
  });

  it('estimates placed material area, waste, sheet use, and cut length', () => {
    const project = createProject();
    project.generatedParts = [contourPart()];
    project.sheetLayouts = [
      {
        id: 'sheet',
        widthMm: 20,
        heightMm: 20,
        marginMm: 2,
        spacingMm: 2,
        placements: [{ partId: 'contour', x: 10, y: 10, rotationDeg: 0 }],
      },
    ];
    const usage = calculateMaterialUsage(project);
    expect(usage).toMatchObject({
      usedSheetCount: 1,
      totalSheetAreaMm2: 400,
      placedPartAreaMm2: 84,
      estimatedWasteAreaMm2: 316,
      utilizationPercent: 21,
    });
    expect(usage.cutLengthMm).toBe(59);
  });

  it('creates stable crosshair registration marks at every sheet corner', () => {
    const sheet = createProject().sheetLayouts[0]!;
    const paths = createRegistrationMarkPaths(sheet);
    expect(paths).toHaveLength(8);
    expect(paths.every((path) => path.operation === 'guide' && !path.closed)).toBe(true);
  });
});
