import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { generateFoldTemplate } from '../../geometry/folding/generateFoldTemplate';
import { useProjectStore } from '../../state/useProjectStore';
import { FoldTemplatePanel } from './FoldTemplatePanel';

describe('FoldTemplatePanel', () => {
  beforeEach(() => {
    const project = createProject('Folding controls');
    project.fabricationMode = 'fold-template';
    useProjectStore.setState({
      project,
      past: [],
      future: [],
      sliceGenerationStatus: 'idle',
      sliceGenerationError: undefined,
    });
  });

  it('stores the fitting axis, template family, clearance, and family controls', async () => {
    const user = userEvent.setup();
    render(<FoldTemplatePanel />);

    await user.selectOptions(screen.getByLabelText('Template family'), 'regular-prism');
    await user.selectOptions(screen.getByLabelText('Fitting axis'), 'x');
    fireEvent.change(screen.getByLabelText('Clearance'), { target: { value: '1.25' } });
    fireEvent.change(screen.getByLabelText('Polygon sides'), { target: { value: '8' } });

    expect(useProjectStore.getState().project.modeParameters).toMatchObject({
      foldTemplateKind: 'regular-prism',
      foldFitAxis: 'x',
      foldClearanceMm: 1.25,
      foldPrismSides: 8,
    });
    expect(screen.getByText(/circumscribed around the model/)).toBeVisible();
  });

  it('shows source and fitted profiles after generation', () => {
    const project = useProjectStore.getState().project;
    if (!project.model.mesh || !project.model.bounds)
      throw new Error('Fixture model is incomplete.');
    const foldingResult = generateFoldTemplate({
      mesh: project.model.mesh,
      bounds: project.model.bounds,
      modelId: project.model.id,
      materialThicknessMm: project.materialProfileSnapshot.thicknessMm,
      settings: {
        templateKind: 'open-box',
        fitAxis: 'z',
        clearanceMm: 1,
        profileToleranceMm: 0.5,
        parameters: { wallHeightMm: 20, tabDepthMm: 8 },
      },
    });
    useProjectStore.setState({
      project: { ...project, foldingResult, generatedParts: foldingResult.parts },
      sliceGenerationStatus: 'ready',
    });

    render(<FoldTemplatePanel />);
    expect(screen.getByTestId('fold-profile-preview')).toBeVisible();
    expect(screen.getByText('1 mm clearance')).toBeVisible();
    expect(screen.getByText(/5 panels/)).toBeVisible();
  });
});
