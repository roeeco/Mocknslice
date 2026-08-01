import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../createProject';
import { useProjectStore } from '../../state/useProjectStore';
import { AppHeader } from './AppHeader';

describe('AppHeader language control', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: createProject('Language test'), past: [], future: [] });
    useProjectStore.getState().setLocale('en');
  });

  it('switches the interface copy to Hebrew while retaining English', async () => {
    const user = userEvent.setup();
    const { container } = render(<AppHeader />);

    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(container.querySelectorAll('svg.history-icon')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveTextContent('');
    await user.click(screen.getByRole('button', { name: 'עב' }));

    expect(useProjectStore.getState().locale).toBe('he');
    expect(screen.getByRole('button', { name: 'ביטול' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });
});
