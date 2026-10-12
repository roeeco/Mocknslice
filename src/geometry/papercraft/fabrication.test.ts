import { describe, expect, it } from 'vitest';
import { papercraftDefaults } from '../../domain/papercraft';
import { hashSerializable } from '../../domain/canonicalHash';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { generatePapercraft } from './buildFabrication';
import { signedArea, convexIntersectionArea, isSimplePolygon } from '../designGraph/polygons';
import { EPS_AREA_MM2 } from '../designGraph/tolerances';
import { unfoldedFaceVerticesAtProgress } from '../unfolding/foldPreview';
import { fitTabToPerimeter, makePapercraftTab } from './tabs';
import { createProject } from '../../app/createProject';
import { createSvgDocument } from '../../exporters/exportSvg';

const cube = createCubeMesh(40).mesh;
const input = () => ({
  mesh: cube,
  materialThicknessMm: 1,
  settings: papercraftDefaults(hashSerializable(cube)),
});
describe('papercraft physical fabrication', () => {
  it('builds closed clean cube contours, paired labels and collision-free physical tabs', () => {
    const result = generatePapercraft(input());
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.parts).toHaveLength(result.islands.length);
    expect(result.tabs.every((t) => t.status === 'enabled')).toBe(true);
    for (const part of result.parts) {
      const cuts = part.paths.filter((p) => p.operation === 'cut');
      expect(cuts.filter((p) => p.contourRole === 'outer')).toHaveLength(1);
      expect(cuts.every((p) => p.closed && isSimplePolygon(p.points))).toBe(true);
      const materialArea =
        result.faces
          .filter((f) => part.unfolding!.faceIds.includes(f.id))
          .reduce((sum, f) => sum + signedArea(f.points), 0) +
        result.tabs
          .filter((t) => t.islandId === part.id)
          .reduce((sum, t) => sum + signedArea(t.outline), 0);
      expect(cuts.reduce((sum, p) => sum + signedArea(p.points), 0)).toBeCloseTo(materialArea, 6);
    }
    for (const tab of result.tabs)
      for (const face of result.faces.filter((f) =>
        result.islands.find((i) => i.id === tab.islandId)!.faceIds.includes(f.id),
      ))
        expect(convexIntersectionArea(tab.outline, face.points)).toBeLessThanOrEqual(EPS_AREA_MM2);
    const counts = new Map<string, number>();
    for (const label of result.parts.flatMap((p) => p.labels ?? []))
      counts.set(label.text, (counts.get(label.text) ?? 0) + 1);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
    expect(result).toEqual(generatePapercraft(input()));
  });
  it('exports physical contour at millimetre scale and folds each triangle rigidly', async () => {
    const result = generatePapercraft(input()),
      project = { ...createProject(), generatedParts: result.parts };
    project.metadata.id = 'papercraft-cube-golden';
    project.fabricationMode = 'mesh-unfold';
    const svg = createSvgDocument(project);
    await expect(svg).toMatchFileSnapshot('../../test-fixtures/papercraft-v2/cube.svg');
    expect(svg).toContain('mm"');
    expect(svg).toMatch(/<path[^>]+d="[^"]+Z"/);
    expect(svg).toContain('operation-cut');
    const unfolded = result.unfolding,
      positions = unfoldedFaceVerticesAtProgress(unfolded, 1);
    for (const face of unfolded.faces) {
      const points = positions.get(face.id)!;
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3,
          flat = Math.hypot(
            ...face.flatVerticesMm[i]!.map((v, k) => v - face.flatVerticesMm[j]![k]!),
          ),
          folded = Math.hypot(...points[i]!.map((v, k) => v - points[j]![k]!));
        expect(folded).toBeCloseTo(flat, 7);
      }
    }
    // Source pair distances throughout one folded body must agree up to a rigid root pose.
    for (const island of unfolded.islands) {
      const faces = unfolded.faces.filter((f) => island.faceIds.includes(f.id));
      const first = faces[0]!;
      for (const face of faces) {
        const sourceDistance = Math.hypot(
            ...face.sourceVerticesMm[0].map((v, k) => v - first.sourceVerticesMm[0][k]!),
          ),
          foldedDistance = Math.hypot(
            ...positions.get(face.id)![0].map((v, k) => v - positions.get(first.id)![0][k]!),
          );
        expect(foldedDistance).toBeCloseTo(sourceDistance, 6);
      }
    }
  });
  it('shrinks oversized tabs, honors explicit suppression, and blocks unresolvable stock floors', () => {
    const large = input();
    large.settings.tabDefaultDepthMm = 100;
    const reduced = generatePapercraft(large);
    expect(reduced.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(reduced.tabs.every((t) => t.depthMm <= 15)).toBe(true);
    expect(reduced.issues.some((i) => i.code === 'PAPERCRAFT_TAB_REDUCED')).toBe(true);
    const edge = reduced.tabs[0]!.edgeKey,
      suppressed = input();
    suppressed.settings.edgeEdits = [
      {
        id: edge,
        intent: 'must-cut' as const,
        tab: { owner: 'none' as const, targetDepthMm: 6, shoulderAngleDeg: 45 },
      },
    ];
    const none = generatePapercraft(suppressed);
    expect(none.tabs.find((t) => t.edgeKey === edge)!.status).toBe('suppressed');
    expect(none.issues.some((i) => i.code === 'PAPERCRAFT_CLOSURE_SUPPRESSED')).toBe(true);
    const thick = generatePapercraft({ ...input(), materialThicknessMm: 20 });
    expect(thick.parts).toEqual([]);
    expect(thick.issues.some((i) => i.code === 'PAPERCRAFT_TAB_UNRESOLVED')).toBe(true);
  });
  it('checks the exact shrink floor and keeps completed progress last', () => {
    const depths: number[] = [],
      outline = makePapercraftTab({ x: 0, y: 0 }, { x: 40, y: 0 }, 3, 45);
    const tab = fitTabToPerimeter(
      3.2,
      1.5,
      10,
      (depth) => ({
        id: 'tab',
        edgeKey: '0:1',
        ownerFaceId: 'face-0',
        receiverFaceId: 'face-1',
        islandId: 'island',
        depthMm: depth,
        shoulderAngleDeg: 45,
        outline,
        status: 'enabled',
      }),
      (candidate) => {
        depths.push(candidate.depthMm);
        return candidate.depthMm === 1.5;
      },
    );
    expect(tab!.depthMm).toBe(1.5);
    expect(depths).toEqual([3.2, 2.7, 2.2, 1.7000000000000002, 1.5]);
    const stages: string[] = [];
    generatePapercraft(input(), { progress: (p) => stages.push(p.stage) });
    expect(stages.at(-1)).toBe('completed');
    expect(stages.indexOf('tabs')).toBeLessThan(stages.lastIndexOf('completed'));
    expect(stages.filter((s) => s === 'completed')).toHaveLength(1);
  });
});
