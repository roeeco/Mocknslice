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
      experienceMode: 'advanced',
    });
    useProjectStore.getState().setLocale('en');
  });

  it('translates all template dimensions in Hebrew', () => {
    useProjectStore.getState().setLocale('he');
    render(<FoldTemplatePanel />);

    expect(screen.getByLabelText('רוחב (X)')).toBeVisible();
    expect(screen.getByLabelText('אורך / עומק (Z)')).toBeVisible();
    expect(screen.getByLabelText('גובה (Y)')).toBeVisible();

    useProjectStore.getState().setLocale('en');
  });

  it('stores standalone dimensions, template family, and family controls', async () => {
    const user = userEvent.setup();
    render(<FoldTemplatePanel />);

    await user.selectOptions(screen.getByLabelText('Template family'), 'regular-prism');
    fireEvent.change(screen.getByLabelText('Width (X)'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Polygon sides'), { target: { value: '8' } });

    expect(useProjectStore.getState().project.modeSettings.foldTemplate).toMatchObject({
      templateKind: 'regular-prism',
      widthMm: 120,
      prismSides: 8,
    });
    expect(screen.queryByLabelText('Fitting axis')).toBeNull();
    expect(screen.getByText(/chosen extrusion length/)).toBeVisible();
  });

  it('keeps press-fit generation controls connected in Advanced mode', async () => {
    const user = userEvent.setup();
    render(<FoldTemplatePanel />);

    await user.selectOptions(screen.getByLabelText('Connection method'), 'press-fit');
    expect(screen.getByLabelText('Press-fit lip depth')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Slit clearance'), { target: { value: '0.3' } });

    expect(useProjectStore.getState().project.modeSettings.foldTemplate).toMatchObject({
      closureMethod: 'press-fit',
      slotClearanceMm: 0.3,
    });
  });

  it('shows the standalone result summary without model provenance', () => {
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
    expect(screen.queryByTestId('fold-profile-preview')).not.toBeInTheDocument();
    expect(screen.getByText(/5 panels/)).toBeVisible();
  });

  it('keeps 3D and keyboard connection selection synchronized with typed edits', async () => {
    const user = userEvent.setup();
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

    const connectionButton = screen
      .getAllByRole('listitem')
      .find((button) => button.textContent?.includes('↔'))!;
    await user.click(connectionButton);
    const selectedId = useProjectStore.getState().selectedEntityId;
    expect(selectedId).toBeTruthy();
    const historyBefore = useProjectStore.getState().past.length;
    await user.selectOptions(screen.getByLabelText('Edge treatment'), 'cut');

    expect(
      useProjectStore
        .getState()
        .project.modeSettings.foldTemplate.connectionOverrides.find(
          (override) => override.connectionId === selectedId,
        ),
    ).toMatchObject({ treatment: 'cut', closure: 'none' });
    expect(useProjectStore.getState().past).toHaveLength(historyBefore + 1);
  });
});
