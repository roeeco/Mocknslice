import { useRef, useState, type ChangeEvent } from 'react';
import { createProjectDownload } from '../../exporters/exportProject';
import { createSheetSvgDownload } from '../../exporters/exportSvg';
import { parseProjectFile, ProjectImportError } from '../../exporters/importProject';
import { copy } from '../../locales/en';
import { useProjectStore } from '../../state/useProjectStore';

const autosaveLabels = {
  idle: 'Local project',
  pending: 'Unsaved changes',
  saving: 'Saving locally…',
  saved: 'Saved locally',
  error: 'Autosave unavailable',
} as const;

export function AppHeader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string>();
  const project = useProjectStore((state) => state.project);
  const autosaveStatus = useProjectStore((state) => state.autosaveStatus);
  const activeSheetId = useProjectStore((state) => state.activeSheetId);
  const createNewProject = useProjectStore((state) => state.createNewProject);
  const replaceProject = useProjectStore((state) => state.replaceProject);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const canUndo = useProjectStore((state) => state.past.length > 0);
  const canRedo = useProjectStore((state) => state.future.length > 0);
  const activeSheet =
    project.sheetLayouts.find((sheet) => sheet.id === activeSheetId) ?? project.sheetLayouts[0];

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      replaceProject(parseProjectFile(await file.text()));
      setImportError(undefined);
    } catch (error) {
      setImportError(
        error instanceof ProjectImportError ? error.message : 'The project could not be imported.',
      );
    } finally {
      event.target.value = '';
    }
  };

  const handleNewProject = () => {
    if (window.confirm('Start a new project? Your current project will remain saved locally.')) {
      createNewProject();
      setImportError(undefined);
    }
  };

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          SF
        </span>
        <div>
          <strong>{copy.appName}</strong>
          <span>{copy.appTagline}</span>
        </div>
      </div>

      <div className="project-status" aria-live="polite">
        <strong>{project.metadata.name}</strong>
        <span className={`save-status status-${autosaveStatus}`}>
          <i aria-hidden="true" /> {autosaveLabels[autosaveStatus]}
        </span>
      </div>

      <div className="header-actions">
        <div className="history-actions" aria-label="Edit history">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl or Command + Z)"
          >
            {copy.undo}
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl or Command + Shift + Z)"
          >
            {copy.redo}
          </button>
        </div>
        <button type="button" onClick={handleNewProject}>
          {copy.newProject}
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          {copy.importProject}
        </button>
        <button
          type="button"
          onClick={() => activeSheet && createSheetSvgDownload(project, activeSheet.id)}
          disabled={!activeSheet || activeSheet.placements.length === 0}
          title={
            !activeSheet || activeSheet.placements.length === 0
              ? 'Place parts on the active sheet before exporting SVG.'
              : undefined
          }
        >
          {copy.exportSvg}
        </button>
        <button
          className="primary-action"
          type="button"
          onClick={() => createProjectDownload(project)}
        >
          {copy.exportProject}
        </button>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void handleImport(event)}
          aria-label="Choose a SliceFold project file"
        />
      </div>

      {importError ? (
        <p className="header-error" role="alert">
          {importError}
        </p>
      ) : null}
    </header>
  );
}
