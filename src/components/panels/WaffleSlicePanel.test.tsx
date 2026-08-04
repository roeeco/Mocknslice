import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { useProjectStore } from '../../state/useProjectStore';
import { WaffleSlicePanel } from './WaffleSlicePanel';

describe('WaffleSlicePanel', () => {
  beforeEach(() => {
    const project = createProject('Waffle controls');
    project.fabricationMode = 'waffle-slices';
    useProjectStore.setState({
      project,
      past: [],
      future: [],
      sliceGenerationStatus: 'idle',
      sliceGenerationError: undefined,
      experienceMode: 'advanced',
    });
  });

  it('stores perpendicular families, clearance, pattern, and reversal as project parameters', async () => {
    const user = userEvent.setup();
    render(<WaffleSlicePanel />);

    expect(screen.getByLabelText('Family A axis')).toHaveValue('x');
    expect(screen.getByLabelText('Family B axis')).toHaveValue('y');
    expect(screen.getByText('0.45 mm', { exact: true })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Family B axis'), 'z');
    fireEvent.change(screen.getByLabelText('Slot clearance'), { target: { value: '0.25' } });
    await user.selectOptions(screen.getByLabelText('Slot pattern'), 'by-family');
    await user.click(screen.getByLabelText('Reverse all slot directions'));

    const parameters = useProjectStore.getState().project.modeParameters;
    expect(parameters.waffleSecondaryAxis).toBe('z');
    expect(parameters.waffleClearanceMm).toBe(0.25);
    expect(parameters.waffleSlotPattern).toBe('by-family');
    expect(parameters.waffleReverseSlots).toBe(true);
    expect(screen.getByText('0.6 mm', { exact: true })).toBeInTheDocument();
  });

  it('is hidden outside waffle mode', () => {
    useProjectStore.setState((state) => ({
      project: { ...state.project, fabricationMode: 'stacked-slices' },
    }));
    const { container } = render(<WaffleSlicePanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
