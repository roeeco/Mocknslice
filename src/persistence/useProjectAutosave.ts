import { useEffect, useRef } from 'react';
import { projectRepository } from './database';
import { useProjectStore } from '../state/useProjectStore';

const AUTOSAVE_DELAY_MS = 500;

export function useProjectAutosave(): void {
  const failedHydrationProject = useRef<
    ReturnType<typeof useProjectStore.getState>['project'] | undefined
  >(undefined);
  const project = useProjectStore((state) => state.project);
  const hasHydrated = useProjectStore((state) => state.hasHydrated);
  const hydrateProject = useProjectStore((state) => state.hydrateProject);
  const setAutosaveStatus = useProjectStore((state) => state.setAutosaveStatus);

  useEffect(() => {
    let disposed = false;
    const startingProject = useProjectStore.getState().project;

    void projectRepository
      .getLastAutosaved()
      .then((savedProject) => {
        if (disposed) return;
        if (useProjectStore.getState().project === startingProject) hydrateProject(savedProject);
        else useProjectStore.setState({ hasHydrated: true });
      })
      .catch(() => {
        if (!disposed) {
          failedHydrationProject.current = useProjectStore.getState().project;
          useProjectStore.setState({ hasHydrated: true });
          setAutosaveStatus('error');
        }
      });

    return () => {
      disposed = true;
    };
  }, [hydrateProject, setAutosaveStatus]);

  useEffect(() => {
    if (!hasHydrated || failedHydrationProject.current === project) return;

    let disposed = false;
    setAutosaveStatus('pending');
    const timeout = window.setTimeout(() => {
      if (disposed || useProjectStore.getState().project !== project) return;
      setAutosaveStatus('saving');
      void projectRepository
        .save(project)
        .then(() => {
          if (!disposed && useProjectStore.getState().project === project)
            setAutosaveStatus('saved');
        })
        .catch(() => {
          if (!disposed && useProjectStore.getState().project === project)
            setAutosaveStatus('error');
        });
    }, AUTOSAVE_DELAY_MS);

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
    };
  }, [hasHydrated, project, setAutosaveStatus]);
}
