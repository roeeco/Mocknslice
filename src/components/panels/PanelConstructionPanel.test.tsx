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

  it('stores enclosure dimensions, joint settings, clearance, and lid choice', async () => {
    const user = userEvent.setup();
    render(<PanelConstructionPanel />);

    fireEvent.change(screen.getByLabelText('Inside width (mm)'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Inside depth (mm)'), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText('Inside height (mm)'), { target: { value: '55' } });
    await user.selectOptions(screen.getByLabelText('Edge joint'), 'tab-slot');
    fireEvent.change(screen.getByLabelText('Target finger width (mm)'), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByLabelText('Slot clearance (mm)'), {
      target: { value: '0.25' },
    });
    await user.click(screen.getByLabelText('Include a fully jointed lid'));
    fireEvent.change(screen.getByLabelText('Dividers across width'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Dividers across depth'), { target: { value: '3' } });

    expect(useProjectStore.getState().project.modeParameters).toMatchObject({
      panelInnerWidthMm: 120,
      panelInnerDepthMm: 70,
      panelInnerHeightMm: 55,
      panelJointKind: 'tab-slot',
      panelFingerWidthMm: 12,
      panelClearanceMm: 0.25,
      panelIncludeLid: true,
      panelWidthDividerCount: 2,
      panelDepthDividerCount: 3,
    });
    expect(screen.getByText(/through-slots/)).toBeVisible();
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
        jointKind: 'tab-slot',
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
});
