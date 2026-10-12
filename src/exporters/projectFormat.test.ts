import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import { serializeProject } from './exportProject';
import { migrateProjectFile, parseProjectFile, ProjectImportError } from './importProject';
import { normalizeMesh } from '../geometry/mesh/normalizeMesh';
import { createCubeSoup } from '../test-fixtures/generatedMeshes';
import { generateFoldTemplate } from '../geometry/folding/generateFoldTemplate';
import { generateMeshUnfold } from '../geometry/unfolding/generateMeshUnfold';
import { generatePanelConstruction } from '../geometry/panelConstruction/generatePanelConstruction';
import { legacyProjectFixtures } from '../test-fixtures/legacyProjectFiles';
import { legacyGenerationSignature } from '../domain/generation';
import type { LegacyProjectData } from '../domain/project';

describe('MocknSlice project format', () => {
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

  it('emits only version 8 with typed mode settings', () => {
    const file = JSON.parse(serializeProject(createProject())) as Record<string, unknown>;
    expect(file).toMatchObject({ format: 'mocknslice-project', version: 8 });
    const project = file.project as Record<string, unknown>;
    expect(project.modeSettings).toBeDefined();
    expect(project.modeParameters).toBeUndefined();
  });

  it('round-trips resolved recipe settings without consulting current registry defaults', () => {
    const project = createProject('Saved classroom kit');
    project.fabricationMode = 'panel-construction';
    project.modeSettings.panelConstruction = {
      ...project.modeSettings.panelConstruction,
      innerWidthMm: 317,
      connectionOverrides: {
        'base-front': { treatment: 'butt' },
        'front-left': { treatment: 'finger', clearanceMm: 0.25 },
      },
      panelProfiles: { front: 'gable', back: 'stepped' },
      recipe: { id: 'survey-ballot-box', revision: 0 },
      features: [
        {
          id: 'saved-opening',
          kind: 'circular-cutout',
          targetRole: 'front',
          anchor: { u: 0.4, v: 0.7 },
          rotationDeg: 12,
          diameterMm: 21,
        },
      ],
    };

    const restored = parseProjectFile(serializeProject(project));
    expect(restored.modeSettings.panelConstruction).toEqual(project.modeSettings.panelConstruction);
  });

  it('round-trips v8 connection overrides, boundary tabs, and inactive template records', () => {
    const project = createProject('Connection records');
    project.modeSettings.foldTemplate.connectionOverrides = [
      {
        id: 'open-box-cut',
        templateKind: 'open-box',
        connectionId: 'fold-front-connection',
        treatment: 'cut',
        closure: 'glue-tab',
        tabOwnerPanelId: 'fold-front',
      },
      {
        id: 'sleeve-crease',
        templateKind: 'sleeve',
        connectionId: 'fold-sleeve-seam-connection',
        treatment: 'crease',
        closure: 'none',
      },
    ];
    project.modeSettings.foldTemplate.boundaryGlueTabs = [
      {
        id: 'free-tab',
        templateKind: 'open-box',
        edgeId: 'fold-front-boundary-1',
        ownerPanelId: 'fold-front',
      },
    ];
    project.modeSettings.panelConstruction.connectionOverrides = {
      'base-front': {
        treatment: 'butt',
        glueTabOwnerPanelId: 'construction-panel-base',
      },
      'lid-back': { treatment: 'crease' },
    };
    project.modeSettings.panelConstruction.boundaryGlueTabs = [
      {
        id: 'panel-free-tab',
        edgeId: 'construction-panel-front:top',
        ownerPanelId: 'construction-panel-front',
      },
    ];

    expect(parseProjectFile(serializeProject(project)).modeSettings).toEqual(project.modeSettings);
  });

  it('migrates v7 joint overrides and marks preserved topology output stale', () => {
    const project = createProject('v7 topology');
    project.fabricationMode = 'panel-construction';
    project.generatedParts = [{ id: 'old-part', name: 'Old part', thicknessMm: 1, paths: [] }];
    project.generationRecord = {
      signatureVersion: 2,
      mode: 'panel-construction',
      inputHash: 'old-input',
      resultHash: 'old-result',
      algorithmVersion: 'old-topology',
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    const file = JSON.parse(serializeProject(project)) as {
      version: number;
      project: {
        modeSettings: { panelConstruction: { connectionOverrides: Record<string, unknown> } };
      };
    };
    file.version = 7;
    file.project.modeSettings.panelConstruction.connectionOverrides = {
      'base-front': { jointKind: 'butt' },
    };

    const restored = parseProjectFile(JSON.stringify(file));
    expect(restored.modeSettings.panelConstruction.connectionOverrides).toEqual({
      'base-front': { treatment: 'butt' },
    });
    expect(restored.generatedParts).toHaveLength(1);
    expect(restored.generationRecord).toBeUndefined();
    expect(restored.generationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CONNECTION_TOPOLOGY_REGENERATION_REQUIRED' }),
      ]),
    );
  });

  it('migrates a valid version 1 project through the current reader', () => {
    const restored = parseProjectFile(legacyProjectFixtures[0].source);

    expect(restored.metadata.id).toBe('project-legacy-fixture');
    expect(restored.modeSettings.stackedSlices.spacingMm).toBe(10);
    expect(restored.modeSettings.panelConstruction.features).toEqual([]);
    expect(JSON.parse(serializeProject(restored))).toMatchObject({
      format: 'mocknslice-project',
      version: 8,
    });
  });

  it('adds Phase 7 output defaults while migrating a version 2 project', () => {
    const restored = parseProjectFile(legacyProjectFixtures[1].source);
    expect(restored.exportSettings).toMatchObject({
      kerfCompensation: 'none',
      customKerfMm: restored.materialProfileSnapshot.kerfMm,
      foldLineOutput: 'preserve',
      perforationDashMm: 2,
      perforationGapMm: 1,
      labelFontSizeMm: 3,
    });
  });

  it('accepts a valid version 4 project without Phase 9 construction data', () => {
    const restored = parseProjectFile(legacyProjectFixtures[3].source);
    expect(restored.panelConstructionResult).toBeUndefined();
    expect(restored.modeSettings.panelConstruction).toMatchObject({
      widthDividerCount: 0,
      depthDividerCount: 0,
      features: [],
    });
  });

  it('upgrades only verifiable v6 provenance and preserves unverifiable artifacts', () => {
    const envelope = JSON.parse(legacyProjectFixtures[5].source) as {
      project: LegacyProjectData;
    };
    envelope.project.generatedParts = [
      { id: 'legacy-part', name: 'Legacy part', thicknessMm: 0.35, paths: [] },
    ];
    envelope.project.generationRecord = {
      ...legacyGenerationSignature(envelope.project),
      resultHash: 'sf9-result',
      algorithmVersion: 'legacy-algorithm',
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    const verified = parseProjectFile(JSON.stringify(envelope));
    expect(verified.generationRecord).toMatchObject({
      signatureVersion: 2,
      resultHash: 'sf9-result',
    });

    const damaged = structuredClone(envelope);
    if (
      damaged.project.generationRecord &&
      !('signatureVersion' in damaged.project.generationRecord)
    ) {
      damaged.project.generationRecord.settingsHash = 'mismatch';
    }
    const unverified = parseProjectFile(JSON.stringify(damaged));
    expect(unverified.generatedParts).toHaveLength(1);
    expect(unverified.generationRecord).toBeUndefined();
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

  it('round-trips a serializable mesh-unfold result with stable face references', () => {
    const project = createProject('Unfolded');
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
    project.unfoldingResult = result;
    project.generatedParts = result.parts;

    const restored = parseProjectFile(serializeProject(project));
    expect(restored.unfoldingResult).toEqual(result);
    expect(restored.generatedParts[0]?.unfolding?.faceIds).toEqual(
      result.faces.filter((face) => face.partId === result.parts[0]?.id).map((face) => face.id),
    );
  });

  it('round-trips a serializable panel-construction result with stable joint references', () => {
    const project = createProject('Panel kit');
    const result = generatePanelConstruction({
      modelId: project.model.id,
      material: {
        id: project.materialProfileSnapshot.id,
        category: project.materialProfileSnapshot.category,
        thicknessMm: project.modeSettings.panelConstruction.panelThicknessMm,
        kerfMm: project.materialProfileSnapshot.kerfMm,
      },
      settings: {
        ...project.modeSettings.panelConstruction,
        innerWidthMm: 80,
        innerDepthMm: 60,
        innerHeightMm: 50,
        jointKind: 'finger',
        fingerWidthMm: 10,
        clearanceMm: 0.15,
        includeLid: false,
      },
    });
    project.fabricationMode = 'panel-construction';
    project.panelConstructionResult = result;
    project.generatedParts = result.parts;

    const restored = parseProjectFile(serializeProject(project));
    expect(restored.panelConstructionResult).toEqual(result);
    expect(restored.generatedParts[0]?.construction?.jointIds).toEqual(
      result.parts[0]?.construction?.jointIds,
    );
  });

  it('upgrades older v7 panel settings and retires tab-slot safely', () => {
    const project = createProject('Older v7 panel');
    const file = JSON.parse(serializeProject(project)) as {
      project: {
        modeSettings: {
          panelConstruction: Record<string, unknown>;
        };
      };
    };
    const settings = file.project.modeSettings.panelConstruction;
    (file as { version?: number }).version = 7;
    settings.jointKind = 'tab-slot';
    delete settings.panelThicknessMm;
    delete settings.dividerThicknessMm;
    delete settings.lidThicknessMm;
    delete settings.connectionOverrides;
    delete settings.panelProfiles;

    const restored = parseProjectFile(JSON.stringify(file));

    expect(restored.modeSettings.panelConstruction).toMatchObject({
      jointKind: 'finger',
      panelThicknessMm: 1,
      dividerThicknessMm: 1,
      lidThicknessMm: 1,
      connectionOverrides: {},
      panelProfiles: { front: 'flat', back: 'flat' },
    });
    expect(restored.generationIssues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PANEL_TAB_SLOT_REPLACED' })]),
    );
  });

  it('rejects unrelated JSON with an understandable error', () => {
    expect(() => parseProjectFile('{"format":"other"}')).toThrowError(
      new ProjectImportError('This file is not a MocknSlice project.'),
    );
  });

  it('rejects unsupported future versions through the migration entry point', () => {
    expect(() =>
      parseProjectFile('{"format":"slicefold-project","version":99,"project":{}}'),
    ).toThrow('Project version 99 is not supported by this build.');
  });

  it('rejects future mocknslice versions and malformed typed settings', () => {
    const file = JSON.parse(serializeProject(createProject())) as Record<string, unknown>;
    file.version = 10;
    expect(() => parseProjectFile(JSON.stringify(file))).toThrow(
      'Project version 10 is not supported by this build.',
    );

    file.version = 7;
    const project = file.project as Record<string, unknown>;
    const modeSettings = project.modeSettings as Record<string, Record<string, unknown>>;
    modeSettings.waffleSlices!.slotPattern = 'unknown-pattern';
    expect(() => parseProjectFile(JSON.stringify(file))).toThrow(
      'The project file is incomplete or damaged.',
    );
  });

  it('rejects non-finite settings and unknown feature discriminators structurally', () => {
    const file = JSON.parse(serializeProject(createProject())) as Record<string, unknown>;
    const project = file.project as Record<string, unknown>;
    const modeSettings = project.modeSettings as Record<string, Record<string, unknown>>;
    modeSettings.stackedSlices!.spacingMm = Number.POSITIVE_INFINITY;
    expect(() => migrateProjectFile(file)).toThrow('The project file is incomplete or damaged.');

    modeSettings.stackedSlices!.spacingMm = 10;
    modeSettings.panelConstruction!.features = [
      {
        id: 'future-feature',
        kind: 'polygon-cutout',
        targetRole: 'base',
        anchor: { u: 0.5, v: 0.5 },
        rotationDeg: 0,
      },
    ];
    expect(() => migrateProjectFile(file)).toThrow('The project file is incomplete or damaged.');
  });

  it('rejects unknown connection keys and profile discriminators structurally', () => {
    const file = JSON.parse(serializeProject(createProject())) as Record<string, unknown>;
    const project = file.project as Record<string, unknown>;
    const modeSettings = project.modeSettings as Record<string, Record<string, unknown>>;
    modeSettings.panelConstruction!.connectionOverrides = {
      'front-lid': { jointKind: 'finger' },
    };
    expect(() => migrateProjectFile(file)).toThrow('The project file is incomplete or damaged.');

    modeSettings.panelConstruction!.connectionOverrides = {};
    modeSettings.panelConstruction!.panelProfiles = { front: 'wave', back: 'flat' };
    expect(() => migrateProjectFile(file)).toThrow('The project file is incomplete or damaged.');
  });

  it('rejects malformed v8 connection discriminators and owners structurally', () => {
    const file = JSON.parse(serializeProject(createProject())) as Record<string, unknown>;
    const project = file.project as Record<string, unknown>;
    const modeSettings = project.modeSettings as Record<string, Record<string, unknown>>;
    modeSettings.panelConstruction!.connectionOverrides = {
      'base-front': { treatment: 'weld' },
    };
    expect(() => migrateProjectFile(file)).toThrow('The project file is incomplete or damaged.');

    modeSettings.panelConstruction!.connectionOverrides = {};
    modeSettings.foldTemplate!.connectionOverrides = [
      {
        id: 'bad-fold',
        templateKind: 'open-box',
        connectionId: 'edge',
        treatment: 'finger',
        closure: 'none',
      },
    ];
    expect(() => migrateProjectFile(file)).toThrow('The project file is incomplete or damaged.');
  });

  it('round-trips structurally valid future panel features without applying geometry rules', () => {
    const project = createProject('Future features');
    project.modeSettings.panelConstruction.features = [
      {
        id: 'feature-label-1',
        kind: 'engraved-label',
        targetRole: 'front',
        anchor: { u: 1.25, v: -0.5 },
        offsetMm: { x: -3, y: 2 },
        rotationDeg: 45,
        purpose: 'classroom identifier',
        text: '',
        fontSizeMm: -2,
      },
    ];
    expect(
      parseProjectFile(serializeProject(project)).modeSettings.panelConstruction.features,
    ).toEqual(project.modeSettings.panelConstruction.features);
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
