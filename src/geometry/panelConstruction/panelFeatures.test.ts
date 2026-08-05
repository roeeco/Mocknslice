import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { resolveClassroomRecipeSettings } from '../../domain/classroomRecipes';
import { getDefaultMaterial } from '../../materials/defaultMaterials';
import type { PanelFeature } from '../../domain/modeSettings';
import type {
  PanelConstructionMaterial,
  PanelConstructionSettings,
} from '../../domain/panelConstruction';
import { createAssemblyPdf } from '../../exporters/exportPdf';
import { createSheetSvgDocument } from '../../exporters/exportSvg';
import { arrangePartsInRows } from '../layout/arrangeParts';
import { prepareFabricationOutput } from '../output/prepareFabricationOutput';
import { generatePanelConstruction } from './generatePanelConstruction';
import { PANEL_FEATURE_CIRCLE_SEGMENTS } from './panelFeatures';

const material: PanelConstructionMaterial = {
  id: 'plywood-3mm',
  category: 'sheet-wood',
  thicknessMm: 3,
  kerfMm: 0.18,
};

const settings: PanelConstructionSettings = {
  innerWidthMm: 160,
  innerDepthMm: 120,
  innerHeightMm: 100,
  jointKind: 'butt',
  fingerWidthMm: 10,
  clearanceMm: 0.15,
  includeLid: true,
};

function generate(features: PanelFeature[]) {
  return generatePanelConstruction({
    sourceId: 'panel-construction',
    material,
    settings: { ...settings, features },
  });
}

function polygonArea(points: readonly { x: number; y: number }[]): number {
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length]!;
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
}

describe('panel feature geometry', () => {
  it.each(['survey-ballot-box', 'flash-card-holder'] as const)(
    'generates the %s recipe feature without a blocking issue',
    (recipeId) => {
      const profile = getDefaultMaterial('card-300gsm');
      const recipeSettings = resolveClassroomRecipeSettings(recipeId, profile);
      const result = generatePanelConstruction({
        sourceId: 'panel-construction',
        material: {
          id: profile.id,
          category: profile.category,
          thicknessMm: profile.thicknessMm,
          kerfMm: profile.kerfMm,
        },
        settings: recipeSettings,
      });
      expect(result.parts.length).toBeGreaterThan(0);
      expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
      expect(result.parts.flatMap((part) => part.paths).some((path) => path.featureId)).toBe(true);
    },
  );

  it('creates deterministic rotated rectangles, polygonal circles, and fabrication labels', () => {
    const features: PanelFeature[] = [
      {
        id: 'circle-b',
        kind: 'circular-cutout',
        targetRole: 'lid',
        anchor: { u: 0.7, v: 0.5 },
        rotationDeg: 17,
        diameterMm: 20,
      },
      {
        id: 'rectangle-a',
        kind: 'rectangular-cutout',
        targetRole: 'lid',
        anchor: { u: 0.3, v: 0.5 },
        rotationDeg: 25,
        widthMm: 30,
        heightMm: 12,
      },
      {
        id: 'label-c',
        kind: 'engraved-label',
        targetRole: 'front',
        anchor: { u: 0.5, v: 0.65 },
        rotationDeg: -10,
        text: 'Class vote',
        fontSizeMm: 5,
      },
    ];
    const original = structuredClone(features);
    const first = generate(features);
    const second = generate([...features].reverse());

    expect(first).toEqual(second);
    expect(features).toEqual(original);
    const lid = first.parts.find((part) => part.construction?.role === 'lid')!;
    expect(lid.paths.find((path) => path.featureId === 'circle-b')?.points).toHaveLength(
      PANEL_FEATURE_CIRCLE_SEGMENTS,
    );
    expect(lid.paths.find((path) => path.featureId === 'circle-b')?.points[0]).toEqual({
      x: 42,
      y: 0,
    });
    expect(
      first.parts
        .find((part) => part.construction?.role === 'front')
        ?.labels?.find((label) => label.featureId === 'label-c'),
    ).toMatchObject({ text: 'Class vote', fontSizeMm: 5, rotationDeg: -10 });
  });

  it('keeps 2D and assembled holes identical and offsets hole kerf inward', () => {
    const result = generate([
      {
        id: 'response-slot',
        kind: 'rectangular-cutout',
        targetRole: 'lid',
        anchor: { u: 0.5, v: 0.5 },
        rotationDeg: 0,
        widthMm: 70,
        heightMm: 12,
      },
    ]);
    const lidPart = result.parts.find((part) => part.construction?.role === 'lid')!;
    const hole = lidPart.paths.find((path) => path.featureId === 'response-slot')!;
    const assembledHole = result.assembledPreview.panels
      .find((panel) => panel.id === 'construction-panel-lid')
      ?.holesVerticesMm?.find((candidate) => candidate.length === hole.points.length);
    expect(assembledHole).toBeDefined();
    if (!assembledHole) throw new Error('Assembled feature hole is missing.');
    expect(assembledHole.map(([x, , z]) => ({ x, y: -z }))).toEqual(hole.points);

    const project = createProject('Feature kerf');
    project.fabricationMode = 'panel-construction';
    project.generatedParts = result.parts;
    project.exportSettings.kerfCompensation = 'custom';
    project.exportSettings.customKerfMm = 0.2;
    const preparedHole = prepareFabricationOutput(project)
      .parts.find((part) => part.id === lidPart.id)!
      .paths.find((path) => path.featureId === 'response-slot')!;
    expect(polygonArea(preparedHole.points)).toBeLessThan(polygonArea(hole.points));
  });

  it('preserves feature holes and labels in SVG and vector PDF output', () => {
    const result = generate([
      {
        id: 'export-hole',
        kind: 'circular-cutout',
        targetRole: 'front',
        anchor: { u: 0.35, v: 0.55 },
        rotationDeg: 0,
        diameterMm: 18,
      },
      {
        id: 'export-label',
        kind: 'engraved-label',
        targetRole: 'front',
        anchor: { u: 0.65, v: 0.55 },
        rotationDeg: 12,
        text: 'Vote',
        fontSizeMm: 5,
      },
    ]);
    const project = createProject('Feature export');
    project.fabricationMode = 'panel-construction';
    project.generatedParts = result.parts;
    project.panelConstructionResult = result;
    project.sheetLayouts = arrangePartsInRows(result.parts, project.sheetLayouts[0]!);
    const svg = createSheetSvgDocument(project, project.sheetLayouts[0]!.id);
    expect(svg).toContain('data-feature-id="export-hole"');
    expect(svg).toContain('data-feature-id="export-label"');
    expect(svg).toContain('>Vote</text>');
    expect(svg).toContain('rotate(12');
    expect(new TextDecoder().decode(createAssemblyPdf(project))).toContain('(Vote) Tj');
  });

  it('generates finite output for hundreds of valid random classroom openings', () => {
    fc.assert(
      fc.property(
        fc.record({
          widthMm: fc.integer({ min: 80, max: 320 }),
          heightMm: fc.integer({ min: 60, max: 240 }),
          u: fc.double({ min: 0.3, max: 0.7, noNaN: true }),
          v: fc.double({ min: 0.3, max: 0.7, noNaN: true }),
          sizeMm: fc.integer({ min: 6, max: 24 }),
          rotationDeg: fc.integer({ min: -180, max: 180 }),
          circular: fc.boolean(),
        }),
        ({ widthMm, heightMm, u, v, sizeMm, rotationDeg, circular }) => {
          const feature: PanelFeature = circular
            ? {
                id: 'random-feature',
                kind: 'circular-cutout',
                targetRole: 'front',
                anchor: { u, v },
                rotationDeg,
                diameterMm: sizeMm,
              }
            : {
                id: 'random-feature',
                kind: 'rectangular-cutout',
                targetRole: 'front',
                anchor: { u, v },
                rotationDeg,
                widthMm: sizeMm,
                heightMm: Math.max(4, sizeMm / 2),
              };
          const result = generatePanelConstruction({
            sourceId: 'property-panel',
            material,
            settings: {
              ...settings,
              innerWidthMm: widthMm,
              innerHeightMm: heightMm,
              features: [feature],
            },
          });
          const numbers = result.parts.flatMap((part) =>
            part.paths.flatMap((path) => path.points.flatMap((point) => [point.x, point.y])),
          );
          expect(numbers.length).toBeGreaterThan(0);
          expect(numbers.every(Number.isFinite)).toBe(true);
        },
      ),
      { seed: 0x50414e45, numRuns: 300 },
    );
  });
});
