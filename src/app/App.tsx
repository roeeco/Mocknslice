import { useEffect } from 'react';
import { useProjectAutosave } from '../persistence/useProjectAutosave';
import { useProjectStore } from '../state/useProjectStore';
import { AppShell } from './layout/AppShell';
import { ThreeViewport } from '../viewports/three/ThreeViewport';
import { TwoViewport } from '../viewports/two/TwoViewport';
import { copy } from '../locales/en';

export function App() {
  useProjectAutosave();
  const viewportMode = useProjectStore((state) => state.viewportMode);
  const setViewportMode = useProjectStore((state) => state.setViewportMode);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [redo, undo]);

  return (
    <AppShell>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Preview</p>
          <h2>{viewportMode === 'three' ? copy.modelPreview : copy.layoutPreview}</h2>
        </div>
        <div className="segmented-control" aria-label="Viewport mode">
          <button
            type="button"
            aria-pressed={viewportMode === 'three'}
            onClick={() => setViewportMode('three')}
          >
            {copy.viewport3d}
          </button>
          <button
            type="button"
            aria-pressed={viewportMode === 'two'}
            onClick={() => setViewportMode('two')}
          >
            {copy.viewport2d}
          </button>
        </div>
      </div>
      {viewportMode === 'three' ? <ThreeViewport /> : <TwoViewport />}
    </AppShell>
  );
}
