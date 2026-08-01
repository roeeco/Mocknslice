import { Canvas } from '@react-three/fiber';
import { ViewportErrorBoundary } from '../../components/common/ViewportErrorBoundary';
import { copy } from '../../locales/en';
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
  const modelId = useProjectStore((state) => state.project.model.id);
  const fabricationMode = useProjectStore((state) => state.project.fabricationMode);

  return (
    <section className="viewport-stage" aria-label={copy.modelPreview}>
      <div className="viewport-toolbar" aria-label="Camera presets">
        {cameraPresets.map((preset) => (
          <button
            type="button"
            key={preset.id}
            className={cameraPreset === preset.id ? 'is-selected' : undefined}
            aria-pressed={cameraPreset === preset.id}
            onClick={() => setCameraPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
        <button type="button" onClick={fitCamera}>
          Fit model
        </button>
      </div>
      <ViewportErrorBoundary key={modelId}>
        <Canvas
          camera={{ position: [82, 68, 82], fov: 38 }}
          shadows
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
          <>
            <span>
              <i className="legend-swatch model-swatch" /> Ghosted model
            </span>
            <span>
              <i className="legend-swatch fold-swatch" /> Assembled template
            </span>
          </>
        ) : fabricationMode === 'mesh-unfold' ? (
          <>
            <span>
              <i className="legend-swatch model-swatch" /> Ghosted source
            </span>
            <span>
              <i className="legend-swatch unfold-swatch" /> Fold preview
            </span>
          </>
        ) : (
          <span>
            <i className="legend-swatch model-swatch" /> Model
          </span>
        )}
        <span>
          <i className="legend-line" /> 10 mm grid
        </span>
      </div>
    </section>
  );
}
