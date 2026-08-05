import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { generatePanelConstruction } from '../../geometry/panelConstruction/generatePanelConstruction';
import { useProjectStore } from '../../state/useProjectStore';
import { PanelConstructionPanel } from './PanelConstructionPanel';

describe('PanelConstructionPanel', () => {
  beforeEach(() => {
    const project = createProject('Panel controls');
    project.fabricationMode = 'panel-construction';
    useProjectStore.setState({
      project,
      past: [],
      future: [],
      sliceGenerationStatus: 'idle',
      sliceGenerationError: undefined,
      experienceMode: 'advanced',
    });
  });

  it('stores dimensions, role-specific stock, divider limits, and cell space', async () => {
    const user = userEvent.setup();
    render(<PanelConstructionPanel />);

    fireEvent.change(screen.getByLabelText('Inside width (mm)'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Inside depth (mm)'), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText('Inside height (mm)'), { target: { value: '55' } });
    expect(screen.getByLabelText('Edge joint')).not.toHaveTextContent('Tabs and through-slots');
    fireEvent.change(screen.getByLabelText('Target finger width (mm)'), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByLabelText(/Base and wall thickness/), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText(/Divider thickness/), { target: { value: '4' } });
    await user.click(screen.getByLabelText('Include a fully jointed lid'));
    fireEvent.change(screen.getByLabelText(/Lid thickness/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Dividers across width'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Dividers across depth'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Slot clearance (mm)'), {
      target: { value: '0.25' },
    });

    expect(useProjectStore.getState().project.modeSettings.panelConstruction).toMatchObject({
      innerWidthMm: 120,
      innerDepthMm: 70,
      innerHeightMm: 55,
      jointKind: 'finger',
      fingerWidthMm: 12,
      clearanceMm: 0.25,
      includeLid: true,
      panelThicknessMm: 3,
      dividerThicknessMm: 4,
      lidThicknessMm: 2,
      widthDividerCount: 2,
      depthDividerCount: 3,
    });
    expect(screen.getByText(/12 cells · 27.0 × 20.7 × 55.0 mm/)).toBeVisible();
    expect(screen.getByLabelText('Dividers across width')).toHaveAttribute('max', '2');
    expect(screen.getByLabelText('Dividers across depth')).toHaveAttribute('max', '5');
  });

  it('shows the generated panel, joint, and slot summary', () => {
    const project = useProjectStore.getState().project;
    const result = generatePanelConstruction({
      modelId: project.model.id,
      material: {
        id: 'plywood-3mm',
        category: 'sheet-wood',
        thicknessMm: 3,
        kerfMm: 0.18,
      },
      settings: {
        innerWidthMm: 80,
        innerDepthMm: 60,
        innerHeightMm: 50,
        jointKind: 'finger',
        fingerWidthMm: 10,
        clearanceMm: 0.15,
        includeLid: false,
      },
    });
    useProjectStore.setState({
      project: { ...project, panelConstructionResult: result, generatedParts: result.parts },
      sliceGenerationStatus: 'ready',
    });
    render(<PanelConstructionPanel />);

    expect(screen.getByTestId('panel-construction-summary')).toHaveTextContent('5 panels');
    expect(screen.getByTestId('panel-construction-summary')).toHaveTextContent('8 joints');
    expect(screen.getByTestId('panel-construction-summary')).toHaveTextContent('slots');
    expect(screen.getByText('5 panels · 8 joints')).toBeVisible();
  });

  it('edits a generated connection through the accessible inspector with undo support', async () => {
    const user = userEvent.setup();
    const project = useProjectStore.getState().project;
    const result = generatePanelConstruction({
      sourceId: 'panel-construction',
      material: {
        id: project.materialProfileSnapshot.id,
        category: project.materialProfileSnapshot.category,
        thicknessMm: 3,
        kerfMm: project.materialProfileSnapshot.kerfMm,
      },
      settings: project.modeSettings.panelConstruction,
    });
    useProjectStore.setState({
      project: { ...project, panelConstructionResult: result, generatedParts: result.parts },
      sliceGenerationStatus: 'ready',
    });
    render(<PanelConstructionPanel />);

    const edgeButton = screen
      .getAllByRole('listitem')
      .find(
        (button) => button.textContent?.includes('Base') && button.textContent.includes('Front'),
      )!;
    await user.click(edgeButton);
    expect(useProjectStore.getState().selectedEntityId).toBe('base-front');
    const historyBefore = useProjectStore.getState().past.length;
    await user.selectOptions(screen.getByLabelText('Edge treatment'), 'crease');

    expect(
      useProjectStore.getState().project.modeSettings.panelConstruction.connectionOverrides[
        'base-front'
      ],
    ).toEqual({ treatment: 'crease' });
    expect(useProjectStore.getState().past).toHaveLength(historyBefore + 1);
    useProjectStore.getState().undo();
    expect(
      useProjectStore.getState().project.modeSettings.panelConstruction.connectionOverrides[
        'base-front'
      ],
    ).toBeUndefined();
  });

  it('keeps finger width and slot clearance available for dividers with butt walls', async () => {
    const user = userEvent.setup();
    render(<PanelConstructionPanel />);

    await user.selectOptions(screen.getByLabelText('Edge joint'), 'butt');
    expect(screen.queryByLabelText('Target finger width (mm)')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Dividers across width'), {
      target: { value: '1' },
    });

    expect(screen.getByLabelText('Target finger width (mm)')).toBeEnabled();
    expect(screen.getByLabelText('Slot clearance (mm)')).toBeEnabled();
    expect(screen.getByText(/base tabs and wall slots/)).toBeVisible();
  });

  it('clamps divider counts when stock or enclosure space reduces the physical maximum', () => {
    render(<PanelConstructionPanel />);
    fireEvent.change(screen.getByLabelText('Dividers across width'), {
      target: { value: '8' },
    });
    expect(
      useProjectStore.getState().project.modeSettings.panelConstruction.widthDividerCount,
    ).toBe(8);

    fireEvent.change(screen.getByLabelText('Divider thickness'), {
      target: { value: '10' },
    });

    expect(screen.getByLabelText('Dividers across width')).toHaveAttribute('max', '0');
    expect(
      useProjectStore.getState().project.modeSettings.panelConstruction.widthDividerCount,
    ).toBe(0);
  });

  it('warns when a raised profile is combined with a lid', async () => {
    const user = userEvent.setup();
    render(<PanelConstructionPanel />);

    await user.selectOptions(screen.getByLabelText('Front profile'), 'arch');
    await user.click(screen.getByLabelText('Include a fully jointed lid'));

    expect(useProjectStore.getState().project.modeSettings.panelConstruction).toMatchObject({
      panelProfiles: { front: 'arch', back: 'flat' },
      includeLid: true,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Raised profiles require an open top');
    expect(useProjectStore.getState().past.length).toBe(2);
  });
});
