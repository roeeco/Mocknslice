import { useMemo, type PropsWithChildren } from 'react';
import { useProjectStore } from '../../state/useProjectStore';
import { PreparedOutputContext } from '../../geometry/output/PreparedOutputContext';
import { evaluateExportReadiness } from '../../geometry/output/evaluateExportReadiness';
export function PreparedOutputProvider({ children }: PropsWithChildren) {
  const project = useProjectStore((s) => s.project),
    profile = useProjectStore((s) => s.fabricationProfile),
    experience = useProjectStore((s) => s.experienceMode);
  const value = useMemo(
    () => ({
      source: project,
      readiness: evaluateExportReadiness(project, {
        profile,
        layoutMode:
          experience === 'standard' &&
          !(project.fabricationMode === 'mesh-unfold' && project.papercraft)
            ? 'tight'
            : 'saved',
      }),
    }),
    [project, profile, experience],
  );
  return <PreparedOutputContext.Provider value={value}>{children}</PreparedOutputContext.Provider>;
}
