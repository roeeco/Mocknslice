import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import { deriveGenerationState, expectedGenerationSignature, hashSerializable } from './generation';
import { buildCanonicalGenerationInput, canonicalGenerationInputHash } from './generationInputs';

function inputHash(project: ReturnType<typeof createProject>) {
  return canonicalGenerationInputHash(buildCanonicalGenerationInput(project));
}

describe('generation provenance', () => {
  it('marks a result stale when a generation parameter changes', () => {
    const project = createProject();
    project.generatedParts = [{ id: 'part', name: 'Part', thicknessMm: 1, paths: [] }];
    project.generationRecord = {
      ...expectedGenerationSignature(project),
      resultHash: hashSerializable(project.generatedParts),
      algorithmVersion: 'sf9-test',
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(deriveGenerationState(project)).toBe('ready');
    project.modeSettings.stackedSlices.spacingMm = 12;
    expect(deriveGenerationState(project)).toBe('stale');
  });

  it('keeps historical results inspectable but unverified', () => {
    const project = createProject();
    project.generatedParts = [{ id: 'part', name: 'Part', thicknessMm: 1, paths: [] }];
    expect(deriveGenerationState(project)).toBe('legacy-unverified');
  });

  it('does not stale active output when an inactive mode changes', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 500, noNaN: true, noDefaultInfinity: true }),
        (value) => {
          const project = createProject();
          const before = inputHash(project);
          project.modeSettings.panelConstruction.innerWidthMm = value;
          expect(inputHash(project)).toBe(before);
        },
      ),
      { seed: 20260804, numRuns: 50 },
    );
  });

  it('changes signatures for active geometry and relevant material fields', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true }),
        (value) => {
          const project = createProject();
          const before = inputHash(project);
          project.modeSettings.stackedSlices.spacingMm = value === 10 ? 11 : value;
          expect(inputHash(project)).not.toBe(before);

          project.fabricationMode = 'fold-template';
          project.modeSettings.foldTemplate.widthMm = 80;
          project.modeSettings.foldTemplate.lengthMm = 60;
          project.modeSettings.foldTemplate.heightMm = 40;
          const foldBefore = inputHash(project);
          project.materialProfileSnapshot.thicknessMm += 0.1;
          expect(inputHash(project)).not.toBe(foldBefore);
        },
      ),
      { seed: 20260805, numRuns: 50 },
    );
  });

  it('excludes irrelevant material and model data from standalone modes', () => {
    const fold = createProject();
    fold.fabricationMode = 'fold-template';
    fold.modeSettings.foldTemplate.widthMm = 80;
    fold.modeSettings.foldTemplate.lengthMm = 60;
    fold.modeSettings.foldTemplate.heightMm = 40;
    const foldBefore = inputHash(fold);
    fold.model.id = 'unrelated-model';
    fold.model.mesh!.positionsMm[0] = 999;
    fold.materialProfileSnapshot.name = 'Renamed material';
    expect(inputHash(fold)).toBe(foldBefore);

    const panel = createProject();
    panel.fabricationMode = 'panel-construction';
    const panelBefore = inputHash(panel);
    panel.model.id = 'another-unrelated-model';
    panel.model.mesh!.positionsMm[0] = 888;
    expect(inputHash(panel)).toBe(panelBefore);
  });

  it('normalizes unordered seam keys and object keys', () => {
    const first = createProject();
    first.fabricationMode = 'mesh-unfold';
    first.modeSettings.meshUnfold.manualSeamKeys = ['2:3', '0:1', '2:3'];
    const second = structuredClone(first);
    second.modeSettings.meshUnfold.manualSeamKeys = ['0:1', '2:3'];
    expect(inputHash(first)).toBe(inputHash(second));
    expect(hashSerializable({ b: 2, a: 1 })).toBe(hashSerializable({ a: 1, b: 2 }));
  });

  it('sorts panel features by stable ID and excludes recipe provenance', () => {
    const first = createProject();
    first.fabricationMode = 'panel-construction';
    first.modeSettings.panelConstruction.recipe = { id: 'survey-ballot-box', revision: 1 };
    first.modeSettings.panelConstruction.features = [
      {
        id: 'feature-b',
        kind: 'circular-cutout',
        targetRole: 'front',
        anchor: { u: 0.5, v: 0.5 },
        rotationDeg: 0,
        diameterMm: 8,
      },
      {
        id: 'feature-a',
        kind: 'rectangular-cutout',
        targetRole: 'base',
        anchor: { u: 0.25, v: 0.75 },
        rotationDeg: 90,
        widthMm: 10,
        heightMm: 4,
      },
    ];
    const second = structuredClone(first);
    second.modeSettings.panelConstruction.recipe = {
      id: 'blank-panel-box',
      revision: 99,
    };
    second.modeSettings.panelConstruction.features.reverse();
    expect(inputHash(second)).toBe(inputHash(first));
    second.modeSettings.panelConstruction.features[0]!.rotationDeg = 45;
    expect(inputHash(second)).not.toBe(inputHash(first));
  });

  it('canonicalizes paired connection overrides and includes bounded profiles', () => {
    const first = createProject();
    first.fabricationMode = 'panel-construction';
    first.modeSettings.panelConstruction.connectionOverrides = {
      'front-left': { treatment: 'finger', clearanceMm: 0.2 },
      'base-front': { treatment: 'butt' },
    };
    const second = structuredClone(first);
    second.modeSettings.panelConstruction.connectionOverrides = {
      'base-front': { treatment: 'butt' },
      'front-left': { clearanceMm: 0.2, treatment: 'finger' },
    };

    expect(inputHash(second)).toBe(inputHash(first));
    second.modeSettings.panelConstruction.panelProfiles.front = 'gable';
    expect(inputHash(second)).not.toBe(inputHash(first));
  });

  it('sorts active connection records and ignores inactive folding-template records', () => {
    const first = createProject();
    first.fabricationMode = 'fold-template';
    first.modeSettings.foldTemplate.connectionOverrides = [
      {
        id: 'override-b',
        templateKind: 'open-box',
        connectionId: 'connection-b',
        treatment: 'cut',
        closure: 'none',
      },
      {
        id: 'inactive-sleeve',
        templateKind: 'sleeve',
        connectionId: 'sleeve-seam',
        treatment: 'crease',
        closure: 'none',
      },
      {
        id: 'override-a',
        templateKind: 'open-box',
        connectionId: 'connection-a',
        treatment: 'cut',
        closure: 'glue-tab',
        tabOwnerPanelId: 'panel-a',
      },
    ];
    first.modeSettings.foldTemplate.boundaryGlueTabs = [
      {
        id: 'boundary-b',
        templateKind: 'open-box',
        edgeId: 'edge-b',
        ownerPanelId: 'panel-b',
      },
      {
        id: 'inactive-boundary',
        templateKind: 'tray',
        edgeId: 'edge-c',
        ownerPanelId: 'panel-c',
      },
    ];
    const second = structuredClone(first);
    second.modeSettings.foldTemplate.connectionOverrides.reverse();
    second.modeSettings.foldTemplate.boundaryGlueTabs.reverse();
    second.modeSettings.foldTemplate.connectionOverrides.find(
      (override) => override.id === 'inactive-sleeve',
    )!.connectionId = 'changed-but-inactive';

    expect(inputHash(second)).toBe(inputHash(first));
    second.modeSettings.foldTemplate.connectionOverrides.find(
      (override) => override.id === 'override-a',
    )!.closure = 'none';
    expect(inputHash(second)).not.toBe(inputHash(first));
  });

  it('rejects non-finite or undefined values before hashing and is repeatable', () => {
    const project = createProject();
    const input = buildCanonicalGenerationInput(project);
    expect(canonicalGenerationInputHash(input)).toBe(canonicalGenerationInputHash(input));
    project.modeSettings.stackedSlices.spacingMm = Number.NaN;
    expect(() => buildCanonicalGenerationInput(project)).toThrow(/finite/);
    expect(() => hashSerializable({ value: undefined })).toThrow(/undefined/);
    expect(() => hashSerializable({ value: Number.POSITIVE_INFINITY })).toThrow(/finite/);
  });
});
