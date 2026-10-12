import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '../app/createProject';
import { generatePanelConstruction } from '../geometry/panelConstruction/generatePanelConstruction';

const workers = vi.hoisted(() => ({
  generateStackedSlicesInWorker: vi.fn(),
  generateWaffleSlicesInWorker: vi.fn(),
  generateFoldTemplateInWorker: vi.fn(),
  generateTemplateGraphInWorker: vi.fn(),
  generateMeshUnfoldInWorker: vi.fn(),
  generatePanelConstructionInWorker: vi.fn(),
}));

vi.mock('../workers/geometryWorkerClient', () => workers);

import { useProjectStore } from './useProjectStore';

describe('generation dispatch race handling', () => {
  beforeEach(() => {
    workers.generateStackedSlicesInWorker.mockReset();
    useProjectStore.setState({
      project: createProject('Worker race'),
      sliceGenerationStatus: 'idle',
      sliceGenerationError: undefined,
      past: [],
      future: [],
    });
  });

  it('rejects a worker result when the active canonical input changed after dispatch', async () => {
    let resolveResult: ((value: { parts: never[]; issues: never[] }) => void) | undefined;
    workers.generateStackedSlicesInWorker.mockReturnValue({
      cancel: vi.fn(),
      promise: new Promise<{ parts: never[]; issues: never[] }>((resolve) => {
        resolveResult = resolve;
      }),
    });

    useProjectStore.getState().generateSlices();
    expect(useProjectStore.getState().sliceGenerationStatus).toBe('processing');
    useProjectStore.getState().updateStackedSliceSettings({ spacingMm: 12 });
    resolveResult?.({ parts: [], issues: [] });

    await vi.waitFor(() => {
      expect(useProjectStore.getState().sliceGenerationStatus).toBe('stale');
    });
    expect(useProjectStore.getState().project.generatedParts).toEqual([]);
    expect(useProjectStore.getState().sliceGenerationError?.code).toBe('GENERATION_INPUT_CHANGED');
  });

  it('retains an edited panel edge selection when regeneration succeeds', async () => {
    const project = createProject('Panel regeneration selection');
    project.fabricationMode = 'panel-construction';
    const result = generatePanelConstruction({
      sourceId: 'panel-construction',
      material: {
        id: project.materialProfileSnapshot.id,
        category: project.materialProfileSnapshot.category,
        thicknessMm: project.modeSettings.panelConstruction.panelThicknessMm,
        kerfMm: project.materialProfileSnapshot.kerfMm,
      },
      settings: project.modeSettings.panelConstruction,
    });
    workers.generatePanelConstructionInWorker.mockReturnValue({
      cancel: vi.fn(),
      promise: Promise.resolve(result),
    });
    useProjectStore.setState({
      project,
      selectedEntityId: 'base-front',
      selectedPartId: 'construction-part-base',
    });

    useProjectStore.getState().generatePanelConstruction();

    await vi.waitFor(() => expect(useProjectStore.getState().sliceGenerationStatus).toBe('ready'));
    expect(useProjectStore.getState().selectedEntityId).toBe('base-front');
    expect(useProjectStore.getState().selectedPartId).toBe('construction-part-base');
  });
});
