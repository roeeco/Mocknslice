import { useEffect } from 'react';
import { projectRepository } from './database';
import { useProjectStore } from '../state/useProjectStore';

const AUTOSAVE_DELAY_MS = 500;

export function useProjectAutosave(): void {
  const project = useProjectStore((state) => state.project);
  const hasHydrated = useProjectStore((state) => state.hasHydrated);
  const hydrateProject = useProjectStore((state) => state.hydrateProject);
  const setAutosaveStatus = useProjectStore((state) => state.setAutosaveStatus);

  useEffect(() => {
    let disposed = false;

    void projectRepository
      .getLastAutosaved()
      .then((savedProject) => {
        if (!disposed) hydrateProject(savedProject);
      })
      .catch(() => {
        if (!disposed) {
          hydrateProject();
          setAutosaveStatus('error');
        }
      });

    return () => {
      disposed = true;
    };
  }, [hydrateProject, setAutosaveStatus]);

  useEffect(() => {
    if (!hasHydrated) return;

    setAutosaveStatus('pending');
    const timeout = window.setTimeout(() => {
      setAutosaveStatus('saving');
      void projectRepository
        .save(project)
        .then(() => setAutosaveStatus('saved'))
        .catch(() => setAutosaveStatus('error'));
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [hasHydrated, project, setAutosaveStatus]);
}
