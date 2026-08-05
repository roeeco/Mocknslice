import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { generateMeshUnfold } from '../../geometry/unfolding/generateMeshUnfold';
import { useProjectStore } from '../../state/useProjectStore';
import { MeshUnfoldPanel } from './MeshUnfoldPanel';

describe('MeshUnfoldPanel', () => {
  beforeEach(() => {
    const project = createProject('Unfold controls');
    project.fabricationMode = 'mesh-unfold';
    useProjectStore.setState({
      project,
      past: [],
      future: [],
      sliceGenerationStatus: 'idle',
      sliceGenerationError: undefined,
      foldPreviewProgress: 0,
      experienceMode: 'advanced',
    });
  });

  it('stores bounded search and tab settings', async () => {
    const user = userEvent.setup();
    render(<MeshUnfoldPanel />);

    await user.selectOptions(screen.getByLabelText('Seam strategy'), 'manual');
    fireEvent.change(screen.getByLabelText('Root triangle'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Tab depth (mm)'), { target: { value: '7.5' } });
    fireEvent.change(screen.getByLabelText('Face limit'), { target: { value: '120' } });

    expect(useProjectStore.getState().project.modeSettings.meshUnfold).toMatchObject({
      strategy: 'manual',
      rootFaceIndex: 3,
      tabDepthMm: 7.5,
      maximumFaceCount: 120,
    });
    expect(screen.getByText(/does not repair meshes/)).toBeVisible();
  });

  it('shows net status, folding progress, and editable manual seam constraints', async () => {
    const user = userEvent.setup();
    const project = useProjectStore.getState().project;
    if (!project.model.mesh) throw new Error('Fixture model is incomplete.');
    const unfoldingResult = generateMeshUnfold({
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
    useProjectStore.setState({
      project: {
        ...project,
        unfoldingResult,
        generatedParts: unfoldingResult.parts,
      },
      sliceGenerationStatus: 'ready',
    });
    render(<MeshUnfoldPanel />);

    expect(screen.getByTestId('mesh-unfold-summary')).toHaveTextContent('11 folds');
    expect(screen.getByText('7 tabs')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Folding preview'), { target: { value: '60' } });
    expect(useProjectStore.getState().foldPreviewProgress).toBe(0.6);

    await user.selectOptions(screen.getByLabelText('Seam strategy'), 'manual');
    const firstEdge = screen.getAllByRole('checkbox')[0]!;
    await user.click(firstEdge);
    expect(useProjectStore.getState().project.modeSettings.meshUnfold.manualSeamKeys[0]).toMatch(
      /^\d+:\d+$/,
    );
    expect(useProjectStore.getState().sliceGenerationStatus).toBe('stale');
  });
});
