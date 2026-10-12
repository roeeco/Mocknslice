import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import { papercraftDefaults } from '../domain/papercraft';
import {
  hashSerializable,
  deriveGenerationState,
  expectedGenerationSignature,
} from '../domain/generation';
import { generatePapercraft } from '../geometry/papercraft/buildFabrication';
import { serializeProject } from './exportProject';
import { parseProjectFile } from './importProject';
import { createStoredProjectRecord, migrateStoredProjectRecord } from '../persistence/database';

function projectWithNet() {
  const project = createProject();
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
  return project;
}
describe('v9 papercraft persistence', () => {
  it('round-trips validated geometry and intent through JSON and unchanged IndexedDB keys', () => {
    const project = projectWithNet(),
      wire = serializeProject(project);
    expect(JSON.parse(wire).version).toBe(9);
    const restored = parseProjectFile(wire);
    expect(JSON.parse(JSON.stringify(restored))).toEqual(JSON.parse(JSON.stringify(project)));
    expect(deriveGenerationState(restored)).toBe('ready');
    const stored = createStoredProjectRecord(project);
    expect(stored.storageVersion).toBe(9);
    expect(migrateStoredProjectRecord(stored).metadata.id).toBe(project.metadata.id);
  });
  it('retains stale edits and old valid artifacts, excluding island layout from geometry signature', () => {
    const project = projectWithNet(),
      hash = expectedGenerationSignature(project).inputHash,
      island = project.papercraft!.result!.islands[0]!;
    project.papercraft!.settings.islandEdits = [
      {
        id: island.id,
        rootFaceId: island.rootFaceId,
        translationMm: [25, 40],
        rotationDeg: 90,
        layoutLocked: true,
      },
    ];
    expect(expectedGenerationSignature(project).inputHash).toBe(hash);
    project.papercraft!.settings.maxCandidates = 1;
    const restored = parseProjectFile(serializeProject(project));
    expect(deriveGenerationState(restored)).toBe('stale');
    expect(restored.generatedParts).toEqual(project.generatedParts);
    expect(restored.papercraft!.settings.islandEdits[0]!.layoutLocked).toBe(true);
  });
  it('rejects damaged contours, unknown source references and oversized native entity lists', () => {
    const project = projectWithNet(),
      damaged = structuredClone(project);
    damaged.papercraft!.result!.graph.features.find(
      (f) => f.operation === 'cut',
    )!.geometry2D[1]!.x = NaN;
    expect(() => parseProjectFile(serializeProject(damaged))).toThrow();
    const reference = structuredClone(project);
    reference.papercraft!.result!.source.halfEdges[0]!.faceId = 'missing';
    expect(() => parseProjectFile(serializeProject(reference))).toThrow('source entities');
    const oversized = structuredClone(project);
    oversized.papercraft!.settings.maxCandidates = 33;
    expect(() => parseProjectFile(serializeProject(oversized))).toThrow('malformed');
  });
  it('rejects finite contour displacement and missing physical creases', () => {
    const shifted = projectWithNet(),
      contour = shifted.papercraft!.result!.graph.features.find((f) => f.kind === 'contour')!;
    contour.geometry2D = contour.geometry2D.map((p) => ({ ...p, x: p.x + 10 }));
    expect(() => parseProjectFile(serializeProject(shifted))).toThrow('geometry validation');
    const missing = projectWithNet(),
      graph = missing.papercraft!.result!.graph,
      crease = graph.features.find((f) => f.operation === 'mountain-fold')!;
    graph.features = graph.features.filter((f) => f.id !== crease.id);
    for (const piece of graph.pieces)
      piece.pathIds = piece.pathIds.filter((id) => id !== crease.id);
    expect(() => parseProjectFile(serializeProject(missing))).toThrow('geometry validation');
  });
  it('keeps the native result when another fabrication mode is active', () => {
    const project = projectWithNet();
    project.fabricationMode = 'fold-template';
    project.generatedParts = [];
    project.unfoldingResult = undefined;
    expect(parseProjectFile(serializeProject(project)).papercraft!.result).toBeDefined();
  });
});
