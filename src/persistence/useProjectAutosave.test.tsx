import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createProject } from '../app/createProject';
import { useProjectStore as store } from '../state/useProjectStore';
import type { ProjectData } from '../domain/project';
const repository = vi.hoisted(() => ({ getLastAutosaved: vi.fn(), save: vi.fn() }));
vi.mock('./database', () => ({ projectRepository: repository }));
import { useProjectAutosave } from './useProjectAutosave';
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.useFakeTimers();
  repository.getLastAutosaved.mockReset();
  repository.save.mockReset().mockResolvedValue(undefined);
  store.setState({
    project: createProject('Initial'),
    hasHydrated: false,
    past: [],
    future: [],
    autosaveStatus: 'pending',
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('does not erase edits or undo history when startup hydration arrives late', async () => {
  const load = deferred<ProjectData | undefined>();
  repository.getLastAutosaved.mockReturnValue(load.promise);
  renderHook(useProjectAutosave);
  const original = store.getState().project;
  const edited = {
    ...original,
    metadata: { ...original.metadata, name: 'Edited before hydration' },
  };
  act(() => store.setState({ project: edited, past: [original] }));
  await act(async () => {
    load.resolve(createProject('Old saved project'));
    await load.promise;
  });
  expect(store.getState().project).toBe(edited);
  expect(store.getState().past).toEqual([original]);
  expect(store.getState().hasHydrated).toBe(true);
});
it('preserves the last saved record after a failed load until the user edits', async () => {
  repository.getLastAutosaved.mockRejectedValue(new Error('Damaged record'));
  renderHook(useProjectAutosave);
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(store.getState().autosaveStatus).toBe('error');
  expect(repository.save).not.toHaveBeenCalled();
  act(() =>
    store.setState({
      project: {
        ...store.getState().project,
        metadata: { ...store.getState().project.metadata, name: 'New edit' },
      },
    }),
  );
  await act(async () => vi.advanceTimersByTimeAsync(500));
  expect(repository.save).toHaveBeenCalledOnce();
});
it('does not mark a newer edit saved when an older save completes', async () => {
  repository.getLastAutosaved.mockResolvedValue(undefined);
  const saving = deferred<void>();
  repository.save.mockReturnValue(saving.promise);
  renderHook(useProjectAutosave);
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => vi.advanceTimersByTimeAsync(500));
  expect(store.getState().autosaveStatus).toBe('saving');
  act(() =>
    store.setState({
      project: {
        ...store.getState().project,
        metadata: { ...store.getState().project.metadata, name: 'Later edit' },
      },
    }),
  );
  await act(async () => {
    saving.resolve();
    await saving.promise;
  });
  expect(store.getState().autosaveStatus).toBe('pending');
});
