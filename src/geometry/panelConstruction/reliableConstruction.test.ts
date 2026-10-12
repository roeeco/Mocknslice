import { describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { generateReliableConstruction } from './generateReliableConstruction';
import { generatePanelConstruction } from './generatePanelConstruction';
import { validateReciprocalJoints } from './validateReciprocalJoints';
import { isSimplePolygon, signedArea } from '../designGraph/polygons';
import { prepareFabricationOutput } from '../output/prepareFabricationOutput';
import { arrangePartsByStock } from '../layout/arrangePartsByStock';
import { intersectPlacedParts } from '../layout/intersectPlacedParts';
const defaults = createProject().modeSettings.panelConstruction;
describe('reciprocal panel fabrication', () => {
  for (const [name, dimensions] of [
    ['wide', [120, 60, 45]],
    ['tall', [70, 55, 110]],
    ['mixed', [90, 75, 60]],
  ] as const)
    for (const thickness of [1, 3])
      it(`${name} at ${thickness} mm validates fingerprints, stocks and actual kerf`, () => {
        const input = {
            sourceId: name,
            material: {
              id: 'test-stock',
              category: 'sheet-wood' as const,
              thicknessMm: thickness,
              kerfMm: 0.1,
            },
            settings: {
              ...defaults,
              innerWidthMm: dimensions[0],
              innerDepthMm: dimensions[1],
              innerHeightMm: dimensions[2],
              panelThicknessMm: thickness,
              dividerThicknessMm: 1.5,
              lidThicknessMm: 2,
              includeLid: true,
              widthDividerCount: 1,
              depthDividerCount: 1,
              roleKerfMm: { panel: 0.1, divider: 0.15, lid: 0.08 },
              roleClearanceMm: { panel: 0.2, divider: 0.25, lid: 0.2 },
            },
          },
          result = generateReliableConstruction(input);
        expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
        expect(result).toEqual(generateReliableConstruction(input));
        expect(
          result.parts.every((p) =>
            p.paths
              .filter((path) => path.operation === 'cut' && path.closed)
              .every((path) => isSimplePolygon(path.points)),
          ),
        ).toBe(true);
        expect(
          result.joints.every(
            (j) =>
              result.panels.some((p) => p.id === j.panelAId) &&
              result.panels.some((p) => p.id === j.panelBId),
          ),
        ).toBe(true);
        const project = createProject();
        project.generatedParts = result.parts;
        project.panelConstructionResult = result;
        project.fabricationMode = 'panel-construction';
        project.exportSettings.kerfCompensation = 'material';
        const prepared = prepareFabricationOutput(project);
        expect(prepared.issues.filter((i) => i.severity === 'error')).toEqual([]);
        expect(
          prepared.appliedKerfByPart![
            result.parts.find((p) => p.construction?.role === 'divider-1')!.id
          ],
        ).toBe(0.15);
        const layouts = arrangePartsByStock(prepared.parts, {
          ...project.sheetLayouts[0]!,
          widthMm: 500,
          heightMm: 500,
        });
        expect(
          layouts.every(
            (sheet) =>
              new Set(
                sheet.placements.map(
                  (p) => prepared.parts.find((part) => part.id === p.partId)!.thicknessMm,
                ),
              ).size <= 1,
          ),
        ).toBe(true);
        expect(intersectPlacedParts(prepared.parts, layouts)).toEqual([]);
      });
  it('removes only zero-area legacy corner retraces while retaining the historical engine', () => {
    const input = {
        sourceId: 'corners',
        material: { id: 'stock', category: 'sheet-wood' as const, thicknessMm: 1, kerfMm: 0 },
        settings: {
          ...defaults,
          panelThicknessMm: 1,
          dividerThicknessMm: 1,
          lidThicknessMm: 1,
          clearanceMm: 0,
        },
      },
      old = generatePanelConstruction(input),
      native = generateReliableConstruction(input);
    expect(old.parts.some((p) => !isSimplePolygon(p.paths[0]!.points))).toBe(true);
    expect(native.parts.every((p) => isSimplePolygon(p.paths[0]!.points))).toBe(true);
    for (const part of native.parts) {
      const legacy = old.parts.find((p) => p.id === part.id)!;
      expect(signedArea(part.paths[0]!.points)).toBeCloseTo(signedArea(legacy.paths[0]!.points), 6);
    }
  });
  it('rejects wrong mating spans, malformed finger counts and mixed-stock creases', () => {
    const input = {
        sourceId: 'negative',
        material: { id: 'stock', category: 'sheet-wood' as const, thicknessMm: 1, kerfMm: 0.1 },
        settings: { ...defaults, panelThicknessMm: 1, dividerThicknessMm: 1, lidThicknessMm: 1 },
      },
      result = generatePanelConstruction(input);
    result.joints[0]!.sharedLengthMm += 5;
    expect(
      validateReciprocalJoints(
        input.settings,
        input.material,
        result.panels,
        result.joints,
        result.parts,
      ).map((i) => i.code),
    ).toContain('PANEL_JOINT_LENGTH_MISMATCH');
    result.joints[0]!.sharedLengthMm -= 5;
    result.joints[0]!.fingerCount = 4;
    expect(
      validateReciprocalJoints(
        input.settings,
        input.material,
        result.panels,
        result.joints,
        result.parts,
      ).map((i) => i.code),
    ).toContain('PANEL_FINGER_PATTERN_INVALID');
    const paper = {
      ...input,
      material: { ...input.material, category: 'corrugated-cardboard' as const },
      settings: {
        ...input.settings,
        includeLid: true,
        lidThicknessMm: 2,
        connectionOverrides: { 'lid-front': { treatment: 'crease' as const } },
      },
    };
    expect(
      generateReliableConstruction(paper).issues.some((i) => i.code === 'PANEL_STOCK_JOIN_INVALID'),
    ).toBe(true);
  });
});
