import { createContext, useContext } from 'react';
import type { ProjectData } from '../domain/project';
import { useProjectStore } from '../state/useProjectStore';

export const PreviewProjectContext = createContext<ProjectData | undefined>(undefined);
export function useDisplayedProject(): ProjectData {
  const committed = useProjectStore((state) => state.project);
  return useContext(PreviewProjectContext) ?? committed;
}
export function useIsDraftPreview(): boolean {
  return Boolean(useContext(PreviewProjectContext));
}

export function useDisplayedProjectField<T>(select: (project: ProjectData) => T): T {
  const committed = useProjectStore((state) => select(state.project));
  const preview = useContext(PreviewProjectContext);
  return preview ? select(preview) : committed;
}
