import { PreparedOutputProvider } from '../components/studio/PreparedOutputProvider';
import { useEffect, useState } from 'react';
import { useProjectAutosave } from '../persistence/useProjectAutosave';
import { useProjectStore } from '../state/useProjectStore';
import { AppShell } from './layout/AppShell';
import { ThreeViewport } from '../viewports/three/ThreeViewport';
import { TwoViewport } from '../viewports/two/TwoViewport';
import { copy } from '../locales';
import { IssueList } from '../components/panels/WarningPanel';
import { StudioShell } from '../components/studio/StudioShell';
import { studioCopy } from '../locales/studioCopy';

export function App() {
  useProjectAutosave();
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [legacy, setLegacy] = useState(() => {
    try {
      return localStorage.getItem('mocknslice-workflow') === 'legacy';
    } catch {
      return false;
    }
  });
  const [combined, setCombined] = useState(false);
  const hasHydrated = useProjectStore((state) => state.hasHydrated);
  const viewportMode = useProjectStore((state) => state.viewportMode);
  const locale = useProjectStore((state) => state.locale);
  const setViewportMode = useProjectStore((state) => state.setViewportMode);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const issueCount = useProjectStore(
    (state) => state.validationIssues.filter((issue) => issue.severity !== 'info').length,
  );
  const issues = useProjectStore((state) => state.validationIssues);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      if (
        event.target instanceof HTMLElement &&
        event.target.getAttribute('data-runtime-draft') === 'true'
      )
        return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [redo, undo]);

  useEffect(() => {
    if (!issuesOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIssuesOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [issuesOpen]);

  if (!hasHydrated)
    return (
      <main className="studio-loading" role="status">
        {studioCopy(locale).loading}
      </main>
    );
  const workspace = (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">{copy.preview}</p>
          <h2>{viewportMode === 'three' ? copy.modelPreview : copy.layoutPreview}</h2>
        </div>
        <div className="workspace-actions">
          {issueCount > 0 ? (
            <button
              type="button"
              className="issue-badge"
              aria-expanded={issuesOpen}
              aria-controls="workspace-issue-drawer"
              onClick={() => setIssuesOpen((open) => !open)}
            >
              {copy.noticeCount(issueCount)}
            </button>
          ) : null}
          <div className="segmented-control" aria-label={copy.viewportMode}>
            <button
              type="button"
              aria-pressed={!combined && viewportMode === 'three'}
              onClick={() => {
                setCombined(false);
                setViewportMode('three');
              }}
            >
              {copy.viewport3d}
            </button>
            <button
              type="button"
              aria-pressed={!combined && viewportMode === 'two'}
              onClick={() => {
                setCombined(false);
                setViewportMode('two');
              }}
            >
              {copy.viewport2d}
            </button>
            {!legacy ? (
              <button
                className="combined-view-control"
                type="button"
                aria-pressed={combined}
                onClick={() => setCombined(true)}
              >
                {studioCopy(locale).combined}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {combined && !legacy ? (
        <div className="dual-preview">
          <ThreeViewport />
          <TwoViewport />
        </div>
      ) : viewportMode === 'three' ? (
        <ThreeViewport />
      ) : (
        <TwoViewport />
      )}
      {issuesOpen ? (
        <aside
          id="workspace-issue-drawer"
          className="issue-drawer"
          role="dialog"
          aria-modal="false"
          aria-labelledby="workspace-issues-heading"
        >
          <div className="panel-heading-row">
            <h2 id="workspace-issues-heading">{copy.warningsPanel}</h2>
            <button type="button" onClick={() => setIssuesOpen(false)} aria-label={copy.close}>
              ×
            </button>
          </div>
          <IssueList issues={issues} />
        </aside>
      ) : null}
    </>
  );
  const toggleWorkflow = (value: boolean) => {
    setLegacy(value);
    setCombined(false);
    try {
      localStorage.setItem('mocknslice-workflow', value ? 'legacy' : 'studio');
    } catch {
      /* Preference remains runtime-only when storage is unavailable. */
    }
  };
  return (
    <PreparedOutputProvider>
      {legacy ? (
        <AppShell onStudio={() => toggleWorkflow(false)}>{workspace}</AppShell>
      ) : (
        <StudioShell onLegacy={() => toggleWorkflow(true)}>{workspace}</StudioShell>
      )}
    </PreparedOutputProvider>
  );
}
