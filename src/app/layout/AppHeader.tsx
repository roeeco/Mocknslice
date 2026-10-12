import { useProjectStore } from '../../state/useProjectStore';
import { copy } from '../../locales';
import { BRAND } from '../../config/brand';
import type { ReactNode } from 'react';

function HistoryIcon({ direction }: { direction: 'undo' | 'redo' }) {
  return (
    <svg className="history-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={direction === 'undo' ? 'M9 7H4V2' : 'M15 7h5V2'} />
      <path d={direction === 'undo' ? 'M4 7a8.5 8.5 0 1 1-1 8.5' : 'M20 7a8.5 8.5 0 1 0 1 8.5'} />
    </svg>
  );
}

export function AppHeader({ trailingActions }: { trailingActions?: ReactNode } = {}) {
  const project = useProjectStore((state) => state.project);
  const autosaveStatus = useProjectStore((state) => state.autosaveStatus);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const canUndo = useProjectStore((state) => state.past.length > 0);
  const canRedo = useProjectStore((state) => state.future.length > 0);
  const locale = useProjectStore((state) => state.locale);
  const setLocale = useProjectStore((state) => state.setLocale);
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          {BRAND.mark}
        </span>
        <div>
          <strong>{copy.appName}</strong>
          <span>{copy.appTagline}</span>
        </div>
      </div>

      <div className="project-status" aria-live="polite">
        <strong>{project.metadata.name}</strong>
        <span className={`save-status status-${autosaveStatus}`}>
          <i aria-hidden="true" /> {copy.autosave[autosaveStatus]}
        </span>
      </div>

      <div className="header-actions">
        {trailingActions}
        <div className="language-actions" aria-label={copy.language}>
          <button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>
            EN
          </button>
          <button type="button" aria-pressed={locale === 'he'} onClick={() => setLocale('he')}>
            עב
          </button>
        </div>
        <div className="history-actions" aria-label={copy.editHistory}>
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label={copy.undo}
            title={`${copy.undo} (Ctrl or Command + Z)`}
          >
            <HistoryIcon direction="undo" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            aria-label={copy.redo}
            title={`${copy.redo} (Ctrl or Command + Shift + Z)`}
          >
            <HistoryIcon direction="redo" />
          </button>
        </div>
      </div>
    </header>
  );
}
