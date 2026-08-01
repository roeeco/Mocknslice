import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import { serializeProject } from './exportProject';
import { parseProjectFile, ProjectImportError } from './importProject';
import { normalizeMesh } from '../geometry/mesh/normalizeMesh';
import { createCubeSoup } from '../test-fixtures/generatedMeshes';
import { generateFoldTemplate } from '../geometry/folding/generateFoldTemplate';

describe('SliceFold project format', () => {
  it('round-trips the current version without losing fabrication data', () => {
    const project = createProject('Round trip');
    project.generatedParts = [
      {
        id: 'part-a',
        name: 'Part A',
        thicknessMm: 1,
        paths: [
          {
            id: 'part-a-cut',
            operation: 'cut',
            closed: true,
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
            ],
          },
          {
            id: 'part-a-slot',
            operation: 'cut',
            closed: false,
            points: [
              { x: 4, y: 0 },
              { x: 4, y: 5 },
              { x: 6, y: 5 },
              { x: 6, y: 0 },
            ],
            slot: {
              pairedPartId: 'part-b',
              intersectionAxis: 'y',
              centreMm: 5,
              widthMm: 2,
              depthMm: 5,
              direction: 'start',
            },
          },
        ],
        waffle: { family: 'a', slotCount: 1 },
      },
    ];
    project.sheetLayouts[0]!.placements = [
      { partId: 'part-a', x: 17.5, y: 23.25, rotationDeg: 90 },
    ];
    const restored = parseProjectFile(serializeProject(project));

    expect(restored).toEqual(project);
    expect(restored.materialProfileSnapshot.name).toBe('300 gsm card');
    expect(restored.sheetLayouts[0]?.placements[0]).toEqual({
      partId: 'part-a',
      x: 17.5,
      y: 23.25,
      rotationDeg: 90,
    });
    expect(restored.generatedParts[0]?.waffle).toEqual({ family: 'a', slotCount: 1 });
    expect(restored.generatedParts[0]?.paths[1]?.slot?.widthMm).toBe(2);
  });

  it('migrates a valid version 1 project through the version 2 reader', () => {
    const project = createProject('Legacy');
    const legacy = JSON.stringify({ format: 'slicefold-project', version: 1, project });

    expect(parseProjectFile(legacy)).toEqual(project);
    expect(JSON.parse(serializeProject(project))).toMatchObject({ version: 2 });
  });

  it('round-trips a serializable folding result with stable panel references', () => {
    const project = createProject('Folded');
    if (!project.model.mesh || !project.model.bounds)
      throw new Error('Fixture model is incomplete.');
    const result = generateFoldTemplate({
      mesh: project.model.mesh,
      bounds: project.model.bounds,
      modelId: project.model.id,
      materialThicknessMm: project.materialProfileSnapshot.thicknessMm,
      settings: {
        templateKind: 'sleeve',
        fitAxis: 'z',
        clearanceMm: 1,
        profileToleranceMm: 0.5,
        parameters: { seamTabMm: 8 },
      },
    });
    project.fabricationMode = 'fold-template';
    project.foldingResult = result;
    project.generatedParts = result.parts;

    const restored = parseProjectFile(serializeProject(project));
    expect(restored.foldingResult).toEqual(result);
    expect(restored.generatedParts[0]?.folding?.panelIds).toEqual(
      result.panels
        .filter((panel) => panel.partId === result.parts[0]?.id)
        .map((panel) => panel.id),
    );
  });

  it('rejects unrelated JSON with an understandable error', () => {
    expect(() => parseProjectFile('{"format":"other"}')).toThrowError(
      new ProjectImportError('This file is not a SliceFold project.'),
    );
  });

  it('rejects unsupported future versions through the migration entry point', () => {
    expect(() =>
      parseProjectFile('{"format":"slicefold-project","version":99,"project":{}}'),
    ).toThrow('Project version 99 is not supported by this build.');
  });

  it('rejects a versioned file with malformed nested dimensions', () => {
    const malformed = JSON.parse(serializeProject(createProject())) as Record<string, unknown>;
    const project = malformed.project as Record<string, unknown>;
    const model = project.model as Record<string, unknown>;
    model.dimensions = { widthMm: 'large', heightMm: 40, depthMm: 40 };

    expect(() => parseProjectFile(JSON.stringify(malformed))).toThrow(
      'The project file is incomplete or damaged.',
    );
  });

  it('round-trips persisted normalized STL geometry and health data', () => {
    const project = createProject('Imported model');
    const normalized = normalizeMesh(createCubeSoup(20), { assumedUnit: 'millimetres' });
    project.model = {
      id: 'model-imported',
      name: 'cube',
      source: { kind: 'imported', fileName: 'cube.stl', format: 'stl' },
      transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1] },
      ...normalized,
    };

    const restored = parseProjectFile(serializeProject(project));
    expect(restored.model.mesh).toEqual(normalized.mesh);
    expect(restored.model.healthReport).toEqual(normalized.healthReport);
    expect(restored.model.importSettings?.assumedUnit).toBe('millimetres');
  });
});
