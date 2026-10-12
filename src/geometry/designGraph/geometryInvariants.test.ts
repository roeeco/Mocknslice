import { describe, expect, it } from 'vitest';
import { createAssemblyPdf } from '../../exporters/exportPdf';
import { createSheetSvgDocument } from '../../exporters/exportSvg';
import { generateFoldTemplate } from '../folding/generateFoldTemplate';
import { generatePanelConstruction } from '../panelConstruction/generatePanelConstruction';
import { generateUpgradeBaseline, upgradeBaselineCases } from '../../test-fixtures/upgradeBaseline';
import { fromLegacyFoldResult } from './fromLegacyFoldResult';
import { fromLegacyPanelResult } from './fromLegacyPanelResult';
import { compileToParts } from './compileToParts';
import { assembleGraph } from './assembleGraph';
import { validateGraph } from './validateGraph';
import { selectionIdentityMap } from './selectionIdentity';
import { DESIGN_GRAPH_ADAPTERS_ENABLED } from './featureFlags';
import {
  convexIntersectionArea,
  isSimplePolygon,
  polygonIntersectionArea,
  triangulatePolygon,
} from './polygons';

function foldFixture(kind: 'open-box' | 'sleeve' = 'open-box') {
  return generateUpgradeBaseline(upgradeBaselineCases.find((c) => c.id === `fold-${kind}`)!);
}

describe('design graph compatibility and invariants', () => {
  it.each(['open-box', 'sleeve'] as const)(
    'preserves %s parts, assembly, identity and exact SVG/PDF',
    (kind) => {
      const { project } = foldFixture(kind);
      const before = JSON.stringify(project.foldingResult);
      const graph = fromLegacyFoldResult(project.foldingResult!);
      expect(validateGraph(graph).filter((i) => i.severity === 'error')).toEqual([]);
      const compiled = compileToParts(graph);
      expect(compiled.parts).toEqual(project.generatedParts);
      const projected = { ...project, generatedParts: compiled.parts };
      for (const sheet of project.sheetLayouts)
        expect(createSheetSvgDocument(projected, sheet.id)).toBe(
          createSheetSvgDocument(project, sheet.id),
        );
      expect(createAssemblyPdf(projected)).toEqual(createAssemblyPdf(project));
      const assembled = assembleGraph(graph).panels;
      for (const panel of project.foldingResult!.assembledPreview.panels)
        expect(assembled.find((p) => p.id === panel.id)).toEqual(panel);
      const map = selectionIdentityMap(graph);
      for (const panel of graph.panels)
        expect(map[panel.id]).toEqual({ entityId: panel.id, partId: panel.pieceId });
      expect(JSON.stringify(project.foldingResult)).toBe(before);
      expect(fromLegacyFoldResult(project.foldingResult!)).toEqual(graph);
      expect(DESIGN_GRAPH_ADAPTERS_ENABLED).toBe(false);
    },
  );

  it('preserves a butt enclosure and its reciprocal stock/assembly', () => {
    const { project } = generateUpgradeBaseline(
      upgradeBaselineCases.find((c) => c.id === 'panel-butt')!,
    );
    const graph = fromLegacyPanelResult(project.panelConstructionResult!);
    expect(validateGraph(graph).filter((i) => i.severity === 'error')).toEqual([]);
    expect(compileToParts(graph).parts).toEqual(project.generatedParts);
    for (const panel of project.panelConstructionResult!.assembledPreview.panels)
      expect(assembleGraph(graph).panels.find((p) => p.id === panel.id)).toEqual(panel);
    const projected = { ...project, generatedParts: compileToParts(graph).parts };
    expect(createSheetSvgDocument(projected, project.sheetLayouts[0]!.id)).toBe(
      createSheetSvgDocument(project, project.sheetLayouts[0]!.id),
    );
  });

  it.each([
    [80, 60, 40],
    [140, 35, 25],
    [45, 90, 70],
  ])('keeps adapters physical at %i × %i × %i and two stocks', (width, length, height) => {
    for (const thickness of [1, 3]) {
      for (const kind of ['open-box', 'sleeve'] as const) {
        const { input } = foldFixture(kind);
        if (input.mode !== 'fold-template') throw new Error('Wrong fixture.');
        const result = generateFoldTemplate({
          ...input.payload,
          materialThicknessMm: thickness,
          settings: {
            ...input.payload.settings,
            envelopeDimensions: { widthMm: width, lengthMm: length, heightMm: height },
            parameters: { ...input.payload.settings.parameters, wallHeightMm: height },
          },
        });
        const graph = fromLegacyFoldResult(result);
        expect(validateGraph(graph).filter((i) => i.severity === 'error')).toEqual([]);
        expect(compileToParts(graph).parts).toEqual(result.parts);
        expect(
          assembleGraph(graph)
            .panels.map((p) => p.id)
            .sort(),
        ).toEqual(result.assembledPreview.panels.map((p) => p.id).sort());
      }
      const { input } = generateUpgradeBaseline(
        upgradeBaselineCases.find((c) => c.id === 'panel-butt')!,
      );
      if (input.mode !== 'panel-construction') throw new Error('Wrong fixture.');
      const result = generatePanelConstruction({
        ...input.payload,
        material: { ...input.payload.material, thicknessMm: thickness },
        settings: {
          ...input.payload.settings,
          innerWidthMm: width,
          innerDepthMm: length,
          innerHeightMm: height,
          panelThicknessMm: thickness,
          dividerThicknessMm: thickness,
          lidThicknessMm: thickness,
        },
      });
      const graph = fromLegacyPanelResult(result);
      expect(validateGraph(graph).filter((i) => i.severity === 'error')).toEqual([]);
      expect(compileToParts(graph).parts).toEqual(result.parts);
    }
  });

  it('blocks duplicate identity, coordinates, references, stock, pose, length and cycle defects', () => {
    const original = fromLegacyFoldResult(foldFixture().project.foldingResult!);
    const invalid = [
      (g: typeof original) => {
        g.panels.push(structuredClone(g.panels[0]!));
      },
      (g: typeof original) => {
        g.panels[0]!.vertices[0]!.x = NaN;
      },
      (g: typeof original) => {
        g.panels[0]!.boundary[0] = 'unknown';
      },
      (g: typeof original) => {
        g.panels[0]!.materialThicknessMm = 0;
      },
      (g: typeof original) => {
        g.panels[0]!.assembledPose![0] = 2;
      },
      (g: typeof original) => {
        g.connections[0]!.edgeA.a = 'unknown';
      },
      (g: typeof original) => {
        g.connections[0]!.tabOwnerPanelId = 'unknown';
      },
      (g: typeof original) => {
        const c = g.connections.find((c) => c.flatJoined)!;
        g.connections.push({ ...c, id: 'cycle' });
      },
      (g: typeof original) => {
        const f = g.features.find((f) => f.operation === 'cut')!;
        g.features.push({ ...structuredClone(f), id: 'duplicate-cut' });
      },
    ];
    for (const mutate of invalid) {
      const graph = structuredClone(original);
      mutate(graph);
      expect(validateGraph(graph).some((i) => i.severity === 'error')).toBe(true);
      expect(compileToParts(graph).parts).toEqual([]);
    }
  });

  it('rejects unsupported face/finger adapters without fabricating a boundary', () => {
    const { project } = generateUpgradeBaseline(
      upgradeBaselineCases.find((c) => c.id === 'panel-mixed-stock')!,
    );
    const graph = fromLegacyPanelResult(project.panelConstructionResult!);
    expect(validateGraph(graph).some((i) => i.code === 'GRAPH_LEGACY_JOINT_UNSUPPORTED')).toBe(
      true,
    );
    expect(compileToParts(graph).parts).toEqual([]);
  });
});

describe('deterministic polygon kernel', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  it('detects self-intersection and separates positive area from edge contact', () => {
    expect(isSimplePolygon([square[0]!, square[2]!, square[1]!, square[3]!])).toBe(false);
    expect(
      polygonIntersectionArea(
        square,
        square.map((p) => ({ x: p.x + 10, y: p.y })),
      ),
    ).toBe(0);
    expect(
      polygonIntersectionArea(
        square,
        square.map((p) => ({ x: p.x + 5, y: p.y })),
      ),
    ).toBeCloseTo(50, 8);
    expect(
      convexIntersectionArea(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
        ],
        [
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 1, y: 1 },
        ],
      ),
    ).toBe(0);
  });
  it('triangulates concavity deterministically and measures its actual area', () => {
    const concave = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 8 },
      { x: 0, y: 8 },
    ];
    expect(triangulatePolygon(concave)).toEqual(triangulatePolygon(concave));
    expect(polygonIntersectionArea(concave, square)).toBeCloseTo(28, 8);
    expect(
      polygonIntersectionArea(concave, [
        { x: 3, y: 3 },
        { x: 7, y: 3 },
        { x: 7, y: 7 },
        { x: 3, y: 7 },
      ]),
    ).toBe(0);
  });
});
