import { describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import type { FabricationPart } from '../../domain/fabrication';
import { hashSerializable, expectedGenerationSignature } from '../../domain/generation';
import { papercraftDefaults } from '../../domain/papercraft';
import { generatePapercraft } from '../papercraft/buildFabrication';
import { evaluateExportReadiness } from './evaluateExportReadiness';
import { canonicalizeContours } from './canonicalizeContours';
import { placedPartIntersectionArea, intersectPlacedParts } from '../layout/intersectPlacedParts';
import { writePreparedSvg, writePreparedPdf } from '../../exporters/writePreparedOutput';

const rect = (id: string, x: number, y: number, w: number, h: number): FabricationPart => ({
  id,
  name: id,
  thicknessMm: 1,
  paths: [
    {
      id: `${id}:cut`,
      operation: 'cut',
      closed: true,
      contourRole: 'outer',
      points: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
    },
  ],
});
function validProject() {
  const project = createProject('Prepared cube');
  project.fabricationMode = 'mesh-unfold';
  project.papercraft = {
    settings: papercraftDefaults(hashSerializable(project.model.mesh!)),
    acceptSimplification: false,
  };
  const result = generatePapercraft({
    mesh: project.model.mesh!,
    settings: project.papercraft.settings,
    materialThicknessMm: project.materialProfileSnapshot.thicknessMm,
  });
  project.papercraft.result = result;
  project.generatedParts = result.parts;
  project.unfoldingResult = result.unfolding;
  project.generationIssues = result.issues;
  project.generationRecord = {
    ...expectedGenerationSignature(project),
    resultHash: hashSerializable(result),
    algorithmVersion: 'papercraft-v2',
    generatedAt: '2026-10-12T00:00:00Z',
  };
  project.sheetLayouts = [
    {
      id: 'sheet-1',
      widthMm: 500,
      heightMm: 500,
      marginMm: 5,
      spacingMm: 3,
      placements: result.parts.map((p, i) => ({
        partId: p.id,
        x: 10 + i * 220,
        y: 10,
        rotationDeg: 0,
      })),
    },
  ];
  return project;
}
const acknowledge = (project: ReturnType<typeof validProject>) => {
  project.acknowledgedWarningIds = evaluateExportReadiness(project).warnings.map((i) => i.id);
  return evaluateExportReadiness(project);
};
describe('prepared export readiness', () => {
  it('requires warning review and freezes exactly the parts subsequently written', () => {
    const project = validProject(),
      before = structuredClone(project),
      draft = evaluateExportReadiness(project);
    expect(draft.status).toBe('draft');
    expect(draft.blockingIssues).toEqual([]);
    expect(() => writePreparedSvg(draft)).toThrow('validated');
    expect(writePreparedSvg(draft, { draft: true })[0]!.name).toContain('-draft-');
    expect(project).toEqual(before);
    expect(Object.isFrozen(project.generatedParts[0])).toBe(false);
    const ready = acknowledge(project);
    expect(ready.status).toBe('ready');
    expect(Object.isFrozen(ready.preparedParts[0]!.paths[0]!.points)).toBe(true);
    const artifacts = writePreparedSvg(ready);
    expect(artifacts).toHaveLength(1);
    const svg = artifacts[0]!.data as string;
    expect(svg).toContain('&quot;schemaVersion&quot;:9');
    expect(svg).toContain(ready.sourceInputHash);
    expect(svg).toContain(ready.snapshotHash);
    expect(svg).toContain('width="500mm" height="500mm" viewBox="0 0 500 500"');
    project.generatedParts = [];
    expect(writePreparedSvg(ready)[0]!.data).toBe(svg);
  });
  it('blocks stale inputs, unplaced pieces, duplicate placements and post-kerf off-sheet shapes', () => {
    const stale = validProject();
    stale.papercraft!.settings.maxCandidates = 1;
    expect(evaluateExportReadiness(stale).blockingIssues.map((i) => i.code)).toContain(
      'GENERATION_STALE',
    );
    const unplaced = validProject();
    unplaced.sheetLayouts[0]!.placements = [];
    expect(evaluateExportReadiness(unplaced).blockingIssues.map((i) => i.code)).toContain(
      'PART_UNPLACED',
    );
    const duplicate = validProject();
    duplicate.sheetLayouts[0]!.placements.push({ ...duplicate.sheetLayouts[0]!.placements[0]! });
    expect(evaluateExportReadiness(duplicate).blockingIssues.map((i) => i.code)).toContain(
      'PART_PLACED_MULTIPLE_TIMES',
    );
    const kerf = validProject();
    kerf.sheetLayouts[0]!.placements[0]!.x = 5;
    kerf.exportSettings.kerfCompensation = 'custom';
    kerf.exportSettings.customKerfMm = 0.2;
    expect(evaluateExportReadiness(kerf).blockingIssues.map((i) => i.code)).toContain(
      'PART_OUTSIDE_SHEET',
    );
  });
  it('does not accept old unverified open contours as production geometry and rejects nonfinite output', () => {
    const project = validProject();
    project.generatedParts = [
      {
        ...rect('open', 0, 0, 10, 10),
        paths: [
          {
            id: 'cut',
            operation: 'cut',
            closed: false,
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
            ],
          },
        ],
      },
    ];
    project.papercraft = undefined;
    project.unfoldingResult = undefined;
    const draft = evaluateExportReadiness(project);
    expect(draft.status).toBe('draft');
    expect(draft.blockingIssues.map((i) => i.code)).toContain('PART_CONTOUR_UNVERIFIED');
    expect(() => writePreparedSvg(draft)).toThrow();
    project.generatedParts[0]!.paths[0]!.points[0]!.x = NaN;
    expect(evaluateExportReadiness(project).status).toBe('blocked');
  });
  it('checks concave material and holes, permitting nesting but detecting epsilon-scale positive overlaps', () => {
    const frame = rect('frame', 0, 0, 30, 30);
    frame.paths.push({
      ...rect('hole', 10, 10, 10, 10).paths[0]!,
      contourRole: 'hole',
      points: [
        { x: 10, y: 10 },
        { x: 10, y: 20 },
        { x: 20, y: 20 },
        { x: 20, y: 10 },
      ],
    });
    const tiny = rect('tiny', 12, 12, 2, 2),
      placement = { partId: 'frame', x: 0, y: 0, rotationDeg: 0 };
    expect(
      placedPartIntersectionArea(frame, placement, tiny, { ...placement, partId: 'tiny' }),
    ).toBe(0);
    const concave = {
      ...rect('L', 0, 0, 20, 20),
      paths: [
        {
          ...rect('L', 0, 0, 20, 20).paths[0]!,
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 5 },
            { x: 5, y: 5 },
            { x: 5, y: 20 },
            { x: 0, y: 20 },
          ],
        },
      ],
    };
    expect(
      placedPartIntersectionArea(concave, placement, rect('nested', 7, 7, 5, 5), placement),
    ).toBe(0);
    expect(
      placedPartIntersectionArea(
        rect('a', 0, 0, 10, 10),
        placement,
        rect('b', 10 - 5e-8, 0, 10, 10),
        placement,
      ),
    ).toBeGreaterThan(1e-8);
    const parts = canonicalizeContours([frame, tiny]).parts;
    expect(
      intersectPlacedParts(parts, [
        {
          id: 'nested',
          widthMm: 40,
          heightMm: 40,
          marginMm: 0,
          spacingMm: 0,
          placements: [placement, { ...placement, partId: 'tiny' }],
        },
      ]),
    ).toEqual([]);
  });
  it('detects partial duplicate cuts and missing metadata references', () => {
    const part = rect('duplicate', 0, 0, 10, 10);
    part.paths.push({
      id: 'duplicate-segment',
      operation: 'cut',
      closed: false,
      points: [
        { x: 2, y: 0 },
        { x: 8, y: 0 },
      ],
    });
    expect(canonicalizeContours([part]).issues.map((i) => i.code)).toContain(
      'OUTPUT_DUPLICATE_CUT',
    );
    const project = validProject();
    project.generatedParts[0]!.paths[0]!.panelId = 'unknown';
    expect(evaluateExportReadiness(project).blockingIssues.map((i) => i.code)).toContain(
      'OUTPUT_REFERENCE_MISSING',
    );
  });
  it('writes all occupied sheets and every PDF page from one frozen snapshot', () => {
    const project = validProject();
    const first = project.generatedParts[0]!;
    for (const path of first.paths) {
      delete path.panelId;
      delete path.edgeId;
      delete path.tabId;
    }
    const second = structuredClone(first);
    second.id = 'second';
    second.name = 'Second';
    second.labels = [];
    for (const path of second.paths) path.id = `second:${path.id}`;
    project.generatedParts = [first, second];
    project.papercraft = undefined;
    project.unfoldingResult = undefined;
    project.sheetLayouts.push({
      ...project.sheetLayouts[0]!,
      id: 'sheet-2',
      placements: [{ partId: 'second', x: 10, y: 10, rotationDeg: 0 }],
    });
    // Keep this synthetic multi-sheet fixture in its JSON wire representation.
    const normalized = JSON.parse(JSON.stringify(project)) as typeof project;
    normalized.generationRecord = {
      ...expectedGenerationSignature(normalized),
      signatureVersion: 3,
      resultHash: hashSerializable(normalized.generatedParts),
      algorithmVersion: 'test-physical-pieces',
      generatedAt: '2026-10-12T00:00:00Z',
    };
    normalized.acknowledgedWarningIds = evaluateExportReadiness(normalized).warnings.map(
      (i) => i.id,
    );
    const ready = evaluateExportReadiness(normalized);
    expect(ready.status).toBe('ready');
    expect(writePreparedSvg(ready).map((a) => a.name)).toEqual([
      'prepared-cube-sheet-01.svg',
      'prepared-cube-sheet-02.svg',
    ]);
    const assembly = evaluateExportReadiness(normalized, { profile: 'assembly-pdf' }),
      pdf = writePreparedPdf(assembly).data as Uint8Array;
    expect(new TextDecoder().decode(pdf)).toContain('/Count 2');
  });
});
