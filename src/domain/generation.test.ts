import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import { deriveGenerationState, expectedGenerationSignature, hashSerializable } from './generation';

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
    project.modeParameters.spacingMm = 12;
    expect(deriveGenerationState(project)).toBe('stale');
  });

  it('keeps historical results inspectable but unverified', () => {
    const project = createProject();
    project.generatedParts = [{ id: 'part', name: 'Part', thicknessMm: 1, paths: [] }];
    expect(deriveGenerationState(project)).toBe('legacy-unverified');
  });
});
