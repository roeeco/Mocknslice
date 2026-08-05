import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import { expectedGenerationSignature, hashSerializable } from '../domain/generation';
import { useProjectStore } from './useProjectStore';

function readyProject() {
  const project = createProject('Canonical generation');
  project.generatedParts = [{ id: 'part', name: 'Part', thicknessMm: 1, paths: [] }];
  project.generationRecord = {
    ...expectedGenerationSignature(project),
    resultHash: hashSerializable(project.generatedParts),
    algorithmVersion: 'test',
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
  return project;
}

describe('canonical generation state updates', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: readyProject(),
      sliceGenerationStatus: 'ready',
      sliceGenerationError: undefined,
      completedWorkflowSteps: ['start', 'mode', 'import', 'configure'],
      past: [],
      future: [],
    });
  });

  it('keeps active output current when an inactive mode setting changes', () => {
    useProjectStore.getState().updatePanelComposerSettings({ innerWidthMm: 120 });
    expect(useProjectStore.getState().sliceGenerationStatus).toBe('ready');
    expect(useProjectStore.getState().completedWorkflowSteps).toContain('configure');
    expect(useProjectStore.getState().past).toHaveLength(1);
  });

  it('stales active output when an active setting changes', () => {
    useProjectStore.getState().updateStackedSliceSettings({ spacingMm: 12 });
    expect(useProjectStore.getState().sliceGenerationStatus).toBe('stale');
    expect(useProjectStore.getState().completedWorkflowSteps).not.toContain('configure');
  });

  it('creates one undo entry per typed patch and preserves inactive settings through undo and redo', () => {
    const originalSpacing = useProjectStore.getState().project.modeSettings.stackedSlices.spacingMm;
    useProjectStore.getState().updatePanelComposerSettings({ innerWidthMm: 135 });
    expect(useProjectStore.getState().past).toHaveLength(1);
    expect(useProjectStore.getState().project.modeSettings.stackedSlices.spacingMm).toBe(
      originalSpacing,
    );
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.modeSettings.panelConstruction.innerWidthMm).toBe(80);
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project.modeSettings.panelConstruction.innerWidthMm).toBe(
      135,
    );
  });

  it('replaces composer settings atomically without changing any other mode', () => {
    const before = structuredClone(useProjectStore.getState().project.modeSettings);
    useProjectStore.getState().replacePanelComposerSettings({
      ...before.panelConstruction,
      innerDepthMm: 99,
      features: [],
    });
    const after = useProjectStore.getState().project.modeSettings;
    expect(after.panelConstruction.innerDepthMm).toBe(99);
    expect(after.stackedSlices).toEqual(before.stackedSlices);
    expect(after.waffleSlices).toEqual(before.waffleSlices);
    expect(after.foldTemplate).toEqual(before.foldTemplate);
    expect(after.meshUnfold).toEqual(before.meshUnfold);
    expect(useProjectStore.getState().past).toHaveLength(1);
  });
});
