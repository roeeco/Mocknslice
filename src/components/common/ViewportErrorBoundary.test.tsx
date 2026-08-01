import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewportErrorBoundary } from './ViewportErrorBoundary';

function Broken({ fail }: { fail: boolean }) {
  if (fail) throw new Error('preview failed');
  return <div>Preview restored</div>;
}

describe('ViewportErrorBoundary', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  afterEach(() => error.mockClear());

  it('recovers when the preview input changes', () => {
    const { rerender } = render(
      <ViewportErrorBoundary resetKey="one">
        <Broken fail />
      </ViewportErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: 'Retry 3D preview' })).toBeVisible();
    rerender(
      <ViewportErrorBoundary resetKey="two">
        <Broken fail={false} />
      </ViewportErrorBoundary>,
    );
    expect(screen.getByText('Preview restored')).toBeVisible();
  });

  it('offers a manual retry without discarding the surrounding UI', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ViewportErrorBoundary resetKey="one">
        <Broken fail />
      </ViewportErrorBoundary>,
    );
    rerender(
      <ViewportErrorBoundary resetKey="one">
        <Broken fail={false} />
      </ViewportErrorBoundary>,
    );
    await user.click(screen.getByRole('button', { name: 'Retry 3D preview' }));
    expect(screen.getByText('Preview restored')).toBeVisible();
  });
});
