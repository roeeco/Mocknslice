import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import golden from '../test-fixtures/golden/stacked-slices.svg?raw';
import sheetGolden from '../test-fixtures/golden/sheet-layout.svg?raw';
import { createSheetSvgDocument, createSvgDocument } from './exportSvg';
import { generateFoldTemplate } from '../geometry/folding/generateFoldTemplate';
import { arrangePartsInRows } from '../geometry/layout/arrangeParts';
import { generateMeshUnfold } from '../geometry/unfolding/generateMeshUnfold';
import { generatePanelConstruction } from '../geometry/panelConstruction/generatePanelConstruction';
import { deriveTightOutputLayout } from '../geometry/layout/deriveTightOutputLayout';
import { prepareFabricationOutput } from '../geometry/output/prepareFabricationOutput';

describe('createSvgDocument', () => {
  it('accepts an explicit tight Standard layout while leaving the saved sheet physical size intact', () => {
    const project = createProject('Tight SVG');
    project.generatedParts = [
      {
        id: 'tight-part',
        name: 'Tight part',
        thicknessMm: 1,
        paths: [
          {
            id: 'tight-cut',
            operation: 'cut',
            closed: true,
            points: [
              { x: 0, y: 0 },
              { x: 20, y: 0 },
              { x: 20, y: 10 },
              { x: 0, y: 10 },
            ],
          },
        ],
      },
    ];
    const saved = structuredClone(project.sheetLayouts);
    const tight = deriveTightOutputLayout(prepareFabricationOutput(project).parts);
    const svg = createSheetSvgDocument(project, tight.id, [tight]);

    expect(svg).toContain(`width="${tight.widthMm}mm" height="${tight.heightMm}mm"`);
    expect(project.sheetLayouts).toEqual(saved);
    expect(project.sheetLayouts[0]!.widthMm).not.toBe(tight.widthMm);
  });

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

  it('preserves unfolded cuts, fold directions, tabs, triangle labels, and version metadata', () => {
    const project = createProject('Unfold layers');
    if (!project.model.mesh) throw new Error('Fixture model is incomplete.');
    const result = generateMeshUnfold({
      mesh: project.model.mesh,
      modelId: project.model.id,
      materialThicknessMm: project.materialProfileSnapshot.thicknessMm,
      settings: {
        strategy: 'automatic',
        rootFaceIndex: 0,
        manualSeamKeys: [],
        tabDepthMm: 6,
        maximumFaceCount: 200,
        searchAttempts: 18,
      },
    });
    project.fabricationMode = 'mesh-unfold';
    project.generatedParts = result.parts;
    project.unfoldingResult = result;
    project.sheetLayouts = arrangePartsInRows(result.parts, project.sheetLayouts[0]!);

    const svg = createSheetSvgDocument(project, project.sheetLayouts[0]!.id);
    expect(svg).toContain('&quot;projectFormatVersion&quot;:8');
    expect(svg).toContain('&quot;mode&quot;:&quot;mesh-unfold&quot;');
    expect(svg).toContain('id="operation-cut"');
    expect(svg).toMatch(/id="operation-(mountain|valley)-fold"/);
    expect(svg).toContain('data-panel-id="unfold-face-');
    expect(svg).toContain('data-edge-id="unfold-edge-');
    expect(svg).toContain('data-tab-id="unfold-tab-');
    expect(svg).toContain('>T1</text>');
    expect(svg).toContain('>S1</text>');
  });

  it('exports panel outlines, divider slots, and paired joint labels', () => {
    const project = createProject('Panel layers');
    const result = generatePanelConstruction({
      modelId: project.model.id,
      material: {
        id: 'plywood-3mm',
        category: 'sheet-wood',
        thicknessMm: 3,
        kerfMm: 0.18,
      },
      settings: {
        innerWidthMm: 80,
        innerDepthMm: 60,
        innerHeightMm: 50,
        jointKind: 'finger',
        fingerWidthMm: 10,
        clearanceMm: 0.15,
        includeLid: false,
        widthDividerCount: 1,
      },
    });
    project.fabricationMode = 'panel-construction';
    project.generatedParts = result.parts;
    project.panelConstructionResult = result;
    project.sheetLayouts = arrangePartsInRows(result.parts, project.sheetLayouts[0]!);

    const svg = createSheetSvgDocument(project, project.sheetLayouts[0]!.id);
    expect(svg).toContain('&quot;projectFormatVersion&quot;:8');
    expect(svg).toContain('&quot;mode&quot;:&quot;panel-construction&quot;');
    expect(svg).toContain('data-panel-id="construction-panel-');
    expect(svg).toContain('data-edge-id="construction-joint-');
    expect(svg).toContain('data-contour-role="hole"');
    expect(svg).toContain('>J1</text>');
  });

  it('exports kerf, perforation, registration, label-size, and style settings visibly', () => {
    const project = createProject('Prepared output');
    project.generatedParts = [
      {
        id: 'prepared-part',
        name: 'Prepared part',
        label: 'P1',
        thicknessMm: 1,
        paths: [
          {
            id: 'prepared-cut',
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
            id: 'prepared-fold',
            operation: 'mountain-fold',
            closed: false,
            points: [
              { x: -5, y: 0 },
              { x: 5, y: 0 },
            ],
          },
        ],
      },
    ];
    project.sheetLayouts[0]!.placements = [
      { partId: 'prepared-part', x: 20, y: 20, rotationDeg: 0 },
    ];
    project.exportSettings.kerfCompensation = 'custom';
    project.exportSettings.customKerfMm = 0.2;
    project.exportSettings.foldLineOutput = 'perforate';
    project.exportSettings.perforationDashMm = 2;
    project.exportSettings.perforationGapMm = 1;
    project.exportSettings.includeRegistrationMarks = true;
    project.exportSettings.labelFontSizeMm = 4;
    project.exportSettings.operationStyles = project.exportSettings.operationStyles.map((style) =>
      style.operation === 'perforate'
        ? { ...style, stroke: '#123456', strokeWidthMm: 0.25 }
        : style,
    );

    const svg = createSheetSvgDocument(project, project.sheetLayouts[0]!.id);
    expect(svg).toContain('&quot;kerfMm&quot;:0.2');
    expect(svg).toContain('M 14.9 14.9 L 25.1 14.9 L 25.1 25.1 L 14.9 25.1 Z');
    expect(svg.match(/prepared-fold-perforation-/g)).toHaveLength(4);
    expect(svg.match(/data-registration-mark="true"/g)).toHaveLength(8);
    expect(svg).toContain(
      'id="operation-perforate" data-operation="perforate" fill="none" stroke="#123456" stroke-width="0.25"',
    );
    expect(svg).toContain(
      'id="part-labels" data-operation="engrave" fill="#000000" stroke="none" font-family="sans-serif" font-size="4"',
    );
  });

  it('blocks vector export when output preparation has an error', () => {
    const project = createProject();
    project.exportSettings.kerfCompensation = 'custom';
    project.exportSettings.customKerfMm = -1;
    expect(() => createSvgDocument(project)).toThrow('Custom kerf must be a non-negative');
  });
});
