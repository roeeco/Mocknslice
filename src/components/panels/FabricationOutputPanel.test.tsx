import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { useProjectStore } from '../../state/useProjectStore';
import { FabricationOutputPanel } from './FabricationOutputPanel';

describe('FabricationOutputPanel', () => {
  beforeEach(() => {
    const project = createProject('Output controls');
    project.generatedParts = [
      {
        id: 'part',
        name: 'Part',
        label: 'P1',
        thicknessMm: 1,
        paths: [
          {
            id: 'part-cut',
            operation: 'cut',
            closed: true,
            contourRole: 'outer',
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 },
            ],
          },
          {
            id: 'part-fold',
            operation: 'valley-fold',
            closed: false,
            points: [
              { x: 0, y: 5 },
              { x: 10, y: 5 },
            ],
          },
        ],
      },
    ];
    project.sheetLayouts[0]!.placements = [{ partId: 'part', x: 10, y: 10, rotationDeg: 0 }];
    useProjectStore.setState({
      project,
      activeSheetId: project.sheetLayouts[0]!.id,
      past: [],
      future: [],
      experienceMode: 'advanced',
    });
  });

  it('stores non-destructive output settings and displays material estimates', async () => {
    const user = userEvent.setup();
    render(<FabricationOutputPanel />);

    await user.selectOptions(screen.getByLabelText('Kerf compensation'), 'custom');
    fireEvent.change(screen.getByLabelText('Custom kerf'), { target: { value: '0.22' } });
    await user.selectOptions(screen.getByLabelText('Fold-line output'), 'perforate');
    fireEvent.change(screen.getByLabelText('Dash length'), { target: { value: '3' } });
    await user.click(screen.getByLabelText('Registration marks'));
    fireEvent.change(screen.getByLabelText('Label size'), { target: { value: '4' } });

    expect(useProjectStore.getState().project.exportSettings).toMatchObject({
      kerfCompensation: 'custom',
      customKerfMm: 0.22,
      foldLineOutput: 'perforate',
      perforationDashMm: 3,
      includeRegistrationMarks: true,
      labelFontSizeMm: 4,
    });
    expect(screen.getByText('0.22 mm', { exact: true })).toBeVisible();
    expect(screen.getByText('1', { exact: true })).toBeVisible();
    expect(screen.getByText('104 mm²', { exact: true })).toBeVisible();
    expect(screen.getByText('41 mm', { exact: true })).toBeVisible();
  });

  it('edits operation colours and widths with accessible labels', () => {
    render(<FabricationOutputPanel />);
    expect(screen.getByText('Operation styles')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Cut colour'), { target: { value: '#00aa11' } });
    fireEvent.change(screen.getByLabelText('Cut width'), { target: { value: '0.2' } });

    expect(
      useProjectStore
        .getState()
        .project.exportSettings.operationStyles.find((style) => style.operation === 'cut'),
    ).toMatchObject({ stroke: '#00aa11', strokeWidthMm: 0.2 });
  });
});
