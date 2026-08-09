import { Canvas } from '@react-three/fiber';
import { ViewportErrorBoundary } from '../../components/common/ViewportErrorBoundary';
import { copy, t } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';
import type { CameraPreset } from '../../state/types';
import { ModelScene } from './ModelScene';

const cameraPresets: { id: CameraPreset; label: string }[] = [
  { id: 'isometric', label: 'Isometric' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'top', label: 'Top' },
];

export function ThreeViewport() {
  const cameraPreset = useProjectStore((state) => state.cameraPreset);
  const setCameraPreset = useProjectStore((state) => state.setCameraPreset);
  const fitCamera = useProjectStore((state) => state.fitCamera);
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const modelId = useProjectStore((state) => state.project.model.id);
  const hasImportedModel = useProjectStore(
    (state) => state.project.model.source.kind === 'imported',
  );
  const fabricationMode = useProjectStore((state) => state.project.fabricationMode);
  const foldingHash = useProjectStore((state) => state.project.foldingResult?.inputHash ?? 'none');
  const unfoldingHash = useProjectStore(
    (state) => state.project.unfoldingResult?.inputHash ?? 'none',
  );
  const panelHash = useProjectStore(
    (state) => state.project.panelConstructionResult?.inputHash ?? 'none',
  );
  const selectedEdgeIsOpen = useProjectStore((state) => {
    const edges =
      state.project.fabricationMode === 'panel-construction'
        ? state.project.panelConstructionResult?.editableEdges
        : state.project.fabricationMode === 'fold-template'
          ? state.project.foldingResult?.editableEdges
          : undefined;
    return Boolean(edges?.some((edge) => edge.id === state.selectedEntityId));
  });
  const resetKey = `${modelId}:${fabricationMode}:${foldingHash}:${unfoldingHash}:${panelHash}`;

  return (
    <section className="viewport-stage" aria-label={copy.modelPreview}>
      <div className="viewport-toolbar" aria-label={t('Camera presets')}>
        {cameraPresets.map((preset) => (
          <button
            type="button"
            key={preset.id}
            className={cameraPreset === preset.id ? 'is-selected' : undefined}
            aria-pressed={cameraPreset === preset.id}
            onClick={() => setCameraPreset(preset.id)}
          >
            {t(preset.label)}
          </button>
        ))}
        <button type="button" onClick={fitCamera}>
          {t('Fit model')}
        </button>
      </div>
      <ViewportErrorBoundary resetKey={resetKey}>
        <Canvas
          camera={{ position: [82, 68, 82], fov: 38 }}
          shadows
          onPointerMissed={() => {
            if (selectedEdgeIsOpen && selectedEntityId) selectEntity();
          }}
          fallback={
            <div className="webgl-fallback" role="alert">
              3D preview is unavailable in this browser. Model inspection data is still available.
            </div>
          }
        >
          <ModelScene />
        </Canvas>
      </ViewportErrorBoundary>
      <div className="viewport-legend">
        {fabricationMode === 'waffle-slices' ? (
          <>
            <span>
              <i className="legend-swatch waffle-a-swatch" /> Family A
            </span>
            <span>
              <i className="legend-swatch waffle-b-swatch" /> Family B
            </span>
          </>
        ) : fabricationMode === 'fold-template' ? (
          <span>
            <i className="legend-swatch fold-swatch" /> {t('Parametric template')}
          </span>
        ) : fabricationMode === 'mesh-unfold' ? (
          <>
            <span>
              <i className="legend-swatch model-swatch" /> Ghosted source
            </span>
            <span>
              <i className="legend-swatch unfold-swatch" /> Fold preview
            </span>
          </>
        ) : fabricationMode === 'panel-construction' ? (
          <span>
            <i className="legend-swatch construction-swatch" /> Assembled panel kit
          </span>
        ) : (
          <span>
            <i className="legend-swatch model-swatch" />{' '}
            {t(hasImportedModel ? 'Model' : 'Import an STL to preview')}
          </span>
        )}
        <span>
          <i className="legend-line" /> {t('10 mm grid')}
        </span>
      </div>
    </section>
  );
}
