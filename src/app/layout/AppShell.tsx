import type { PropsWithChildren } from 'react';
import { copy } from '../../locales';
import { WorkflowNavigation } from '../../components/workflow/WorkflowNavigation';
import { WorkflowPanel } from '../../components/workflow/WorkflowPanel';
import { AppHeader } from './AppHeader';
import { useProjectStore } from '../../state/useProjectStore';

function ExperienceModeIcon({ advanced }: { advanced: boolean }) {
  return advanced ? (
    <svg className="experience-mode-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
    </svg>
  ) : (
    <svg className="experience-mode-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M12 5v14" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const experienceMode = useProjectStore((state) => state.experienceMode);
  const setExperienceMode = useProjectStore((state) => state.setExperienceMode);
  return (
    <div className="app-shell">
      <AppHeader />
      <aside className="left-sidebar">
        <div className="sidebar-title">
          <p className="eyebrow">{copy.workspace}</p>
          <h1>{copy.projectPanel}</h1>
        </div>
        <div className="experience-mode-control" aria-label={copy.experienceMode}>
          <button
            type="button"
            aria-label={copy.standardMode}
            title={copy.standardMode}
            aria-pressed={experienceMode === 'standard'}
            onClick={() => setExperienceMode('standard')}
          >
            <ExperienceModeIcon advanced={false} />
          </button>
          <button
            type="button"
            aria-label={copy.advancedMode}
            title={copy.advancedMode}
            aria-pressed={experienceMode === 'advanced'}
            onClick={() => setExperienceMode('advanced')}
          >
            <ExperienceModeIcon advanced />
          </button>
        </div>
        <WorkflowNavigation />
      </aside>
      <main className="main-workspace">{children}</main>
      <aside className="right-sidebar">
        <WorkflowPanel />
      </aside>
    </div>
  );
}
