import { createContext, useContext, useMemo } from 'react';
import type { ProjectData } from '../../domain/project';
import { useProjectStore } from '../../state/useProjectStore';
import { evaluateExportReadiness, type ExportReadiness } from './evaluateExportReadiness';
export const PreparedOutputContext = createContext<
  { source: ProjectData; readiness: ExportReadiness } | undefined
>(undefined);
export function usePreparedOutput(project: ProjectData): ExportReadiness {
  const shared = useContext(PreparedOutputContext),
    profile = useProjectStore((s) => s.fabricationProfile),
    experience = useProjectStore((s) => s.experienceMode);
  return useMemo(
    () =>
      shared?.source === project
        ? shared.readiness
        : evaluateExportReadiness(project, {
            profile,
            layoutMode:
              experience === 'standard' &&
              !(project.fabricationMode === 'mesh-unfold' && project.papercraft)
                ? 'tight'
                : 'saved',
          }),
    [shared, project, profile, experience],
  );
}
